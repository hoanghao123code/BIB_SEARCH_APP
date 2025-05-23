document.addEventListener('DOMContentLoaded', function() {
    const raceEventFilter = document.getElementById('raceEventFilter');
    const momentFilter = document.getElementById('momentFilter');
    const imageGridContainer = document.getElementById('imageGridContainer');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const resultsTitle = document.getElementById('resultsTitle');
    const ajaxLoadingIndicator = document.getElementById('ajaxLoadingIndicator');
    const ajaxMessage = document.getElementById('ajaxMessage');

    const pageCache = new Map();
    const lastDocCache = new Map();  // Lưu last_doc_id cho từng trang
    const filterState = {
        raceEvent: 'all',
        momentFilter: 'all'
    };
    let currentPage = 1;

    // --- Logic cho Image Modal ---
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalCaption = document.getElementById('imageModalCaption');
    const downloadBtn = document.getElementById('downloadImageBtn');
    const closeModalBtn = document.querySelector('.image-modal-close-btn');

    function openImageModal(imageUrl, caption, downloadFilename) {
        if (imageModal && modalImage && downloadBtn) {
            imageModal.style.display = "block";
            modalImage.src = imageUrl;
            if (modalCaption) modalCaption.textContent = caption || '';
            downloadBtn.href = imageUrl;
            downloadBtn.download = downloadFilename || 'downloaded_image';
        }
    }

    function handleThumbnailClick(event) {
        const fullsizeUrl = event.currentTarget.dataset.fullsizeUrl;
        const filename = event.currentTarget.dataset.filename;
        const altText = event.currentTarget.alt;
        openImageModal(fullsizeUrl, altText, filename);
    }

    function attachThumbnailClickListeners() {
        const thumbnails = document.querySelectorAll('#imageGridContainer .thumbnail-image');
        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', handleThumbnailClick);
        });
    }

    if (closeModalBtn) {
        closeModalBtn.onclick = function() {
            if (imageModal) imageModal.style.display = "none";
        }
    }
    if (imageModal) {
        imageModal.onclick = function(event) {
            if (event.target === imageModal) {
                imageModal.style.display = "none";
            }
        }
    }

    // --- Hàm quản lý trạng thái loading ---
    function toggleLoading(isLoading) {
        ajaxLoadingIndicator.style.display = isLoading ? 'block' : 'none';
    }

    // --- Hàm cập nhật dropdown khoảnh khắc ---
    function updateMomentDropdown(selectedRaceFullName) {
        if (!momentFilter) return;
        while (momentFilter.options.length > 1) {
            momentFilter.remove(1);
        }
        momentFilter.disabled = true;
        // momentFilter.add(new Option('Tất cả khoảnh khắc', 'all'));

        if (selectedRaceFullName && selectedRaceFullName !== 'all') {
            const encodedEventName = encodeURIComponent(selectedRaceFullName);
            fetch(window.ajaxEndpoints.getMoments.replace('RACE_PLACEHOLDER', encodedEventName))
                .then(response => {
                    if (!response.ok) throw new Error('Network response for moments was not ok');
                    return response.json();
                })
                .then(data => {
                    if (data.success && data.moments && Array.isArray(data.moments) && data.moments.length > 0) {
                        data.moments.forEach(momentName => momentFilter.add(new Option(momentName, momentName)));
                        momentFilter.disabled = false;
                    }
                })
                .catch(error => {
                    console.error('Lỗi fetch moments:', error);
                    momentFilter.disabled = true;
                });
        }
    }

    function updatePagination(totalItems, currentPage, type) {
        const perPage = 15;
        const totalPages = Math.ceil(totalItems / perPage);
        const paginationContainer = document.createElement('nav');
        paginationContainer.className = 'mt-4';
        const paginationList = document.createElement('ul');
        paginationList.className = 'pagination justify-content-center';

        const existingPagination = document.querySelector('.pagination-container');
        if (existingPagination) existingPagination.remove();

        if (totalPages <= 1) return;

        const prevItem = document.createElement('li');
        prevItem.className = 'page-item' + (currentPage == 1 ? ' disabled' : '');
        prevItem.innerHTML = `<a class="page-link" href="#">« < </a>`;
        if (currentPage > 1) {
            prevItem.addEventListener('click', (e) => {
                e.preventDefault();
                displayCachedPage(currentPage - 1, type);
            });
        }
        paginationList.appendChild(prevItem);

        const currentPageItem = document.createElement('li');
        currentPageItem.className = 'page-item current-page';
        currentPageItem.innerHTML = `<span class="page-link">${currentPage}</span>`;
        paginationList.appendChild(currentPageItem);

        const nextItem = document.createElement('li');
        nextItem.className = 'page-item' + (lastDocCache.get(currentPage) ? '' : ' disabled');
        nextItem.innerHTML = `<a class="page-link" href="#"> > »</a>`;
        if (lastDocCache.get(currentPage)) {
            nextItem.addEventListener('click', (e) => {
                e.preventDefault();
                displayCachedPage(currentPage + 1, type);
            });
        }
        paginationList.appendChild(nextItem);

        paginationContainer.appendChild(paginationList);
        paginationContainer.className += ' pagination-container';
        imageGridContainer.parentNode.insertBefore(paginationContainer, imageGridContainer.nextSibling);
        
        preloadNearbyPages(currentPage, totalPages, type);
    }

    function displayCachedPage(page, type) {
        const cacheKey = `${page}_${filterState.raceEvent}_${filterState.momentFilter}`;
        const cachedData = pageCache.get(cacheKey);
        if (cachedData) {
            currentPage = page;
            renderPage(cachedData, page, type);
        } else {
            fetchAndDisplayPhotos(page);
        }
    }

    function renderPage(data, page, type) {
        imageGridContainer.innerHTML = '';
        noResultsMessage.style.display = 'none';
        clearTimeout(window.noResultsTimeout);
        if (data.success) {
            if (data.type == "images") {
                let titleText = "Danh sách ảnh";
                if (data.race_event_filter && data.race_event_filter !== 'all') {
                    titleText = `Ảnh từ giải ${data.race_event_filter}`;
                    if (data.moment_filter && data.moment_filter !== 'all') {
                        titleText += ` tại khoảnh khắc ${data.moment_filter}`;
                    }
                }
                resultsTitle.textContent = titleText;
                if (data.images && Array.isArray(data.images) && data.images.length > 0) {
                    data.images.forEach(imgObj => {
                        const serveImageUrl = window.ajaxEndpoints.serveImage || '';
                        const imageUrl = imgObj.image_url ? encodeURIComponent(imgObj.image_url) : '';
                        if (!serveImageUrl) {
                            console.warn('Missing serveImage for imgObj:', imgObj);
                            return; // Bỏ qua nếu thiếu dữ liệu
                        }
                        const imageCard = document.createElement('div');
                        imageCard.className = 'col-md-4 mb-3';
                        imageCard.innerHTML = `
                            <div class="card">
                                <a href="${window.ajaxEndpoints.serveImage.replace('PATH_PLACEHOLDER', encodeURIComponent(imgObj.image_url))}" target="_blank">
                                    <img src="${window.ajaxEndpoints.serveImage.replace('PATH_PLACEHOLDER', encodeURIComponent(imgObj.image_url))}" 
                                         alt="${imgObj.race_event_name || 'N/A'} - ${imgObj.moment_name || 'N/A'}" 
                                         class="card-img-top" style="max-height: 200px; object-fit: cover;">
                                </a>
                                <div class="card-body">
                                    <p><strong>Giải chạy:</strong> ${imgObj.race_event_name || 'N/A'}</p>
                                    <p><strong>Khoảnh khắc:</strong> ${imgObj.moment_name || 'N/A'}</p>
                                    <button class="btn btn-danger btn-sm delete-image-btn" data-image-id="${imgObj.id}">
                                        <i class="fas fa-trash-alt"></i> Xóa
                                    </button>
                                </div>
                            </div>
                        `;
                        imageGridContainer.appendChild(imageCard);
                    });
                    attachDeleteListeners();
                    updatePagination(data.total_images, page, "images");
                } else {
                    noResultsMessage.style.display = 'block';
                    noResultsMessage.querySelector('p').textContent = data.message || 'Không tìm thấy ảnh nào phù hợp.';
                    window.noResultsTimeout = setTimeout(() => {
                        noResultsMessage.style.display = 'none';
                    }, 2000)
                }
            } else {
                resultsTitle.textContent = "Lỗi";
                noResultsMessage.style.display = 'block';
                noResultsMessage.querySelector('p').textContent = data.message || 'Có lỗi xảy ra từ máy chủ.';
            }
        }
    }

    function preloadNearbyPages(currentPage, totalPages, type) {
        const raceEvent = filterState.raceEvent;
        const momentValue = filterState.momentFilter;

        // Preload trang sau nếu có last_doc_id
        if (lastDocCache.get(currentPage) && !pageCache.has(`${currentPage + 1}_${raceEvent}_${momentValue}`)) {
            const queryParamsNext = new URLSearchParams({
                race_event_filter: raceEvent,
                moment_filter: momentValue,
                last_doc_id: lastDocCache.get(currentPage),
                per_page: 15
            });
            fetch(`${window.ajaxEndpoints.searchImages}?${queryParamsNext.toString()}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        pageCache.set(`${currentPage + 1}_${raceEvent}_${momentValue}`, data);
                        if (data.last_doc_id) lastDocCache.set(currentPage + 1, data.last_doc_id);
                        if (currentPage + 1 < totalPages) {
                            preloadNearbyPages(currentPage + 1, totalPages, type);
                        }
                    }
                })
                .catch(error => console.error('Lỗi tiền tải trang sau:', error));
        }
    }

    function fetchAndDisplayPhotos(page = 1) {
        const raceEvent = raceEventFilter.value;
        const momentValue = momentFilter.value;
        filterState.raceEvent = raceEvent;
        filterState.momentFilter = momentValue;

        toggleLoading(true);
        imageGridContainer.innerHTML = '';
        noResultsMessage.style.display = 'none';

        const cacheKey = `${page}_${raceEvent}_${momentValue}`;
        const queryParams = new URLSearchParams({
            race_event_filter: raceEvent,
            moment_filter: momentValue,
            per_page: 15
        });

        // Nếu không phải trang 1, thêm last_doc_id từ trang trước
        if (page > 1) {
            const prevPageKey = page - 1;
            const lastDocId = lastDocCache.get(prevPageKey);
            if (lastDocId) {
                queryParams.set('last_doc_id', lastDocId);
            } else {
                toggleLoading(false);
                return; // Không thể tiếp tục nếu thiếu last_doc_id
            }
        }

        fetch(`${window.ajaxEndpoints.searchImages}?${queryParams.toString()}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                toggleLoading(false);
                if (data.success) {
                    // console.log("success");
                    currentPage = page;
                    pageCache.set(cacheKey, data);
                    if (data.last_doc_id) lastDocCache.set(page, data.last_doc_id);
                    if (data.images && data.images.length > 0) {
                        renderPage(data, page, "images");
                    } else if (page > 1) {
                        console.log("No images on page, going back to previous page:", page - 1);
                        fetchAndDisplayPhotos(page - 1);
                    } else {
                        renderPage(data, page, "images"); // Trang 1 rỗng, hiển thị thông báo
                    }
                    // renderPage(data, page, "images");
                }
            })
            .catch(error => {
                console.error('Lỗi fetch ảnh:', error);
                toggleLoading(false);
                resultsTitle.textContent = "Lỗi kết nối";
                noResultsMessage.style.display = 'block';
                noResultsMessage.querySelector('p').textContent = 'Không thể kết nối tới máy chủ hoặc có lỗi xảy ra khi tải dữ liệu.';
            });
    }

    function attachDeleteListeners() {
        const deleteButtons = document.querySelectorAll('.delete-image-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const imageId = this.getAttribute('data-image-id');
                if (confirm('Bạn có chắc chắn muốn xóa ảnh này?')) {
                    toggleLoading(true);
                    fetch(`${window.ajaxEndpoints.adminDeleteImage}?image_id=${imageId}`, {
                        method: 'DELETE',
                        headers: {
                        'Content-Type': 'application/json' // Đảm bảo header đúng
                    },
                    body: JSON.stringify({ image_id: imageId }) // Gửi image_id qua body JSON
                    })
                    .then(response => response.json())
                    .then(data => {
                        toggleLoading(false);
                        if (data.success) {
                            ajaxMessage.className = 'alert alert-success';
                            ajaxMessage.textContent = data.message;
                            ajaxMessage.style.display = 'block';
                            fetchAndDisplayPhotos(1);
                        } else {
                            ajaxMessage.className = 'alert alert-danger';
                            ajaxMessage.textContent = data.message;
                            ajaxMessage.style.display = 'block';
                        }
                        setTimeout(() => ajaxMessage.style.display = 'none', 5000);
                    })
                    .catch(error => {
                        console.error('Lỗi xóa ảnh:', error);
                        toggleLoading(false);
                        ajaxMessage.className = 'alert alert-danger';
                        ajaxMessage.textContent = 'Lỗi khi xóa ảnh.';
                        ajaxMessage.style.display = 'block';
                        setTimeout(() => ajaxMessage.style.display = 'none', 5000);
                    });
                }
            });
        });
    }

    if (raceEventFilter) {
        raceEventFilter.addEventListener('change', function() {
            updateMomentDropdown(this.value);
            fetchAndDisplayPhotos(1);
        });
    }

    if (momentFilter) {
        momentFilter.addEventListener('change', function() {
            fetchAndDisplayPhotos(1);
        });
    }

    // Hiển thị dữ liệu ban đầu
    const initialImagesCount = window.totalImages || 0;
    if (initialImagesCount > 0) {
        fetchAndDisplayPhotos(1);
    } else {
        noResultsMessage.style.display = 'block';
    }
});