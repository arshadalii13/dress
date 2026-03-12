const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const CAT_FILE = path.join(__dirname, 'categories.json');
const UPLOAD_DIR = path.join(__dirname, 'images');
const ADMIN_PASSWORD = '9521@Kotasuits';
const AUTH_TOKEN = 'kota_admin_secret_token_2026'; // Simple static token for demo/small app

// Middleware
app.use(cors());
app.use(express.json());

// Auth Middleware
const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization'];
    if (token === AUTH_TOKEN) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Protect admin.html and admin.js specifically
app.get('/admin.html', (req, res, next) => {
    // We can't easily check headers for a direct browser page load without cookies
    // So we'll skip server-side protection for the .html file itself to allow loading,
    // but the sensitive API and the logic in admin.js will require the token.
    // Alternatively, we could use cookies, but let's stick to headers for API security.
    next();
});



// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Initialize data.json if missing
if (!fs.existsSync(DATA_FILE)) {
    const initialData = [
        {
            id: '1', title: "Royal Zardosi", category: "embroidery", 
            description: "Exquisite hand-stitched floral embroidery with metallic threads on premium velvet.", price: "150", images: ["images/embroidery.png"]
        },
        {
            id: '2', title: "Heritage Indigo", category: "block-print", 
            description: "Traditional geometric and botanical block print in deep indigo on organic cotton.", price: "85", images: ["images/block_print.png"]
        },
        {
            id: '3', title: "Abstract Flow", category: "brush-paint", 
            description: "Expressive sweeping strokes of pastel and neon on high-quality dark canvas.", price: "120", images: ["images/brush_paint.png"]
        },
        {
            id: '4', title: "Urban Vector", category: "screen-print", 
            description: "Modern minimalist high-contrast screen print on a sleek dark fabric base.", price: "65", images: ["images/screen_print.png"]
        }
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
}

// Initialize categories.json if missing
if (!fs.existsSync(CAT_FILE)) {
    const defaultCategories = ["embroidery", "block-print", "brush-paint", "screen-print"];
    fs.writeFileSync(CAT_FILE, JSON.stringify(defaultCategories, null, 2));
}

// ─── Auth Routes ───────────────────────────────────────────────
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, token: AUTH_TOKEN });
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

// ─── Category Routes ───────────────────────────────────────────
app.get('/api/categories', (req, res) => {
    try {
        const data = fs.readFileSync(CAT_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: 'Failed to read categories' });
    }
});

app.post('/api/categories', authMiddleware, (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Category name required' });
        
        const categories = JSON.parse(fs.readFileSync(CAT_FILE, 'utf8'));
        const safeName = name.toLowerCase().trim().replace(/\s+/g, '-');
        
        if (categories.includes(safeName)) {
            return res.status(400).json({ error: 'Category already exists' });
        }
        
        categories.push(safeName);
        fs.writeFileSync(CAT_FILE, JSON.stringify(categories, null, 2));
        res.json({ success: true, category: safeName });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save category' });
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ─── Product Routes ────────────────────────────────────────────
app.get('/api/products', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// Protected Routes
app.post('/api/upload', authMiddleware, upload.array('images', 10), (req, res) => {
    try {
        const { title, category, description, price } = req.body;
        
        if (!title || !category || !price || !req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Missing required fields or images' });
        }

        const newProduct = {
            id: Date.now().toString(),
            title,
            category,
            description,
            price,
            images: req.files.map(file => `images/${file.filename}`)
        };

        const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        products.unshift(newProduct);
        fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));

        res.json({ success: true, product: newProduct });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error during upload.' });
    }
});

app.delete('/api/products/:id', authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const index = products.findIndex(p => p.id === id);

        if (index === -1) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        products.splice(index, 1);
        fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete product.' });
    }
});

app.use(express.static(__dirname));

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
