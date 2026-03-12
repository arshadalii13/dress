document.addEventListener('DOMContentLoaded', () => {
    const productGrid = document.getElementById('product-grid');
    const filterBtns  = document.querySelectorAll('.filter-btn');

    // ─── Lightbox ────────────────────────────────────────────────────
    const lightbox    = document.createElement('div');
    lightbox.className = 'lightbox-overlay';
    lightbox.innerHTML = `
        <button class="lightbox-close" aria-label="Close">✕</button>
        <img class="lightbox-img" src="" alt="Preview">
    `;
    document.body.appendChild(lightbox);

    const lbImg = lightbox.querySelector('.lightbox-img');

    const openLightbox = (src) => {
        lbImg.src = src;
        lightbox.classList.add('open');
    };

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
            lightbox.classList.remove('open');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') lightbox.classList.remove('open');
    });

    // ─── Fetch ────────────────────────────────────────────────────────
    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/products');
            if (!res.ok) throw new Error('API Error');
            return await res.json();
        } catch (err) {
            console.error('Fetch error:', err);
            productGrid.innerHTML = '<p style="color:#6b6b6b;grid-column:1/-1;text-align:center;padding:3rem 0;">Failed to load products. Please ensure the server is running.</p>';
            return [];
        }
    };

    // ─── Render Cards ─────────────────────────────────────────────────
    const displayProducts = (items) => {
        productGrid.innerHTML = '';

        if (items.length === 0) {
            productGrid.innerHTML = '<p style="color:#6b6b6b;grid-column:1/-1;text-align:center;padding:3rem 0;">No products found.</p>';
            return;
        }

        const downloadIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;

        items.forEach((product, idx) => {
            const images = (product.images && product.images.length > 0)
                ? product.images
                : (product.image ? [product.image] : []);

            const hasMany = images.length > 1;
            const formatCat = (c) => c ? c.replace(/-/g, ' ') : '';

            // ── Thumbnail strip HTML
            const thumbsHtml = hasMany
                ? images.map((src, i) =>
                    `<img src="${src}" alt="View ${i+1}" class="thumb-img${i === 0 ? ' active' : ''}" data-index="${i}" loading="lazy">`
                  ).join('')
                : '';

            const card = document.createElement('div');
            card.className = 'product-card card-animate';
            card.style.animationDelay = `${idx * 60}ms`;

            card.innerHTML = `
                <div class="card-img-wrapper">
                    <img src="${images[0] || ''}" alt="${product.title}" class="main-img" loading="lazy">
                    <span class="card-category-badge">${formatCat(product.category)}</span>
                    ${images.length > 1 ? `<span class="img-count-badge">1 / ${images.length}</span>` : ''}
                </div>
                ${hasMany ? `<div class="thumbnail-strip">${thumbsHtml}</div>` : ''}
                <div class="card-content">
                    <p class="card-category-label">${formatCat(product.category)}</p>
                    <h3 class="card-title">${product.title}</h3>
                    <p class="card-desc">${product.description || ''}</p>
                    <div class="card-footer">
                        <span class="card-price"><sup>₹</sup>${Number(product.price).toLocaleString('en-IN')}</span>
                        <button class="save-btn" title="Download Current Image">
                            ${downloadIcon} Save Image
                        </button>
                    </div>
                </div>
            `;

            // ── Refs
            const mainImg   = card.querySelector('.main-img');
            const countBadge = card.querySelector('.img-count-badge');
            let   currentIdx = 0;

            // ── Thumbnail click → swap main image
            if (hasMany) {
                const thumbs = card.querySelectorAll('.thumb-img');
                const switchImage = (newIdx) => {
                    thumbs[currentIdx].classList.remove('active');
                    currentIdx = newIdx;
                    mainImg.src = images[currentIdx];
                    thumbs[currentIdx].classList.add('active');
                    if (countBadge) countBadge.textContent = `${currentIdx + 1} / ${images.length}`;
                };

                thumbs.forEach(thumb => {
                    thumb.addEventListener('click', (e) => {
                        switchImage(parseInt(e.currentTarget.dataset.index));
                    });
                });
            }

            // ── Click main image → lightbox
            mainImg.addEventListener('click', () => openLightbox(mainImg.src));

            // ── Save / download button
            const saveBtn = card.querySelector('.save-btn');
            saveBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const originalHtml = saveBtn.innerHTML;
                saveBtn.innerHTML = 'Downloading…';
                saveBtn.disabled = true;

                try {
                    const img     = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.src = mainImg.src;

                    await new Promise((res, rej) => {
                        img.onload  = res;
                        img.onerror = () => rej(new Error('Image load failed'));
                    });

                    const canvas = document.createElement('canvas');
                    canvas.width  = img.width;
                    canvas.height = img.height;
                    const ctx     = canvas.getContext('2d');
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);

                    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.95));
                    if (!blob) throw new Error('Blob failed');

                    const filename = `${product.title.replace(/\s+/g, '_').toLowerCase()}_${currentIdx + 1}.jpg`;
                    const url  = URL.createObjectURL(blob);
                    const a    = document.createElement('a');
                    a.href     = url;
                    a.download = filename;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } catch (err) {
                    console.error('Download error:', err);
                    alert('Error downloading image.');
                } finally {
                    saveBtn.innerHTML = originalHtml;
                    saveBtn.disabled  = false;
                }
            });

            productGrid.appendChild(card);
        });
    };

    // ─── Init ──────────────────────────────────────────────────────────
    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/categories');
            return await res.json();
        } catch (err) {
            console.error('Failed to fetch categories');
            return ["embroidery", "block-print", "brush-paint", "screen-print"]; // Fallback
        }
    };

    const initCategories = (categories) => {
        const categorySelect = document.getElementById('category-filter');
        if (categorySelect) {
            // Keep "All Designs" as first option
            categorySelect.innerHTML = '<option value="all">All Designs</option>' + 
                categories.map(cat => 
                    `<option value="${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}</option>`
                ).join('');
        }
    };

    const initApp = async () => {
        const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
        initCategories(categories);

        // Helper function to render products based on filter
        const renderProducts = (filter) => {
            const filteredProducts = filter === 'all'
                ? products
                : products.filter(p => p.category === filter);
            displayProducts(filteredProducts);
        };

        // ─── Filter Functionality (Dropdown) ──────────────────────────
        const categorySelect = document.getElementById('category-filter');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                const filter = e.target.value;
                renderProducts(filter);
            });
        }

        // Initial display of all products
        renderProducts('all');
    };

    initApp();
});
