document.addEventListener('DOMContentLoaded', function() {
    const raceEventFilter = document.getElementById('race_event_filter');
    const momentFilterSelect = document.getElementById('moment_filter');
    const photoSearchForm = document.getElementById('photoSearchForm');
    const imageGridContainer = document.getElementById('imageGridContainer');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const resultsTitle = document.getElementById('resultsTitle');
    const ajaxLoadingIndicator = document.getElementById('ajaxLoadingIndicator');
    const searchSubmitButton = document.getElementById('searchSubmitButton');
    const searchIcon = searchSubmitButton ? searchSubmitButton.querySelector('.fa-search') : null;
    const searchSpinner = searchSubmitButton ? searchSubmitButton.querySelector('.spinner-border-sm') : null;

    const filterState = {
        'bibNumber': '',
        'raceEvent': 'all',
        'momentFilter': 'all'
    };

    const pageCache = new Map()
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

    // --- Hàm quản lý trạng thái nút tìm kiếm ---
    function toggleSearchButtonState(isSearching) {
        if (!searchSubmitButton || !searchIcon || !searchSpinner) return;
        searchSubmitButton.disabled = isSearching;
        searchSubmitButton.classList.toggle('btn-searching', isSearching);
        searchIcon.style.display = isSearching ? 'none' : 'inline-block';
        searchSpinner.style.display = isSearching ? 'inline-block' : 'none';
    }

    // --- Hàm cập nhật dropdown khoảnh khắc ---
    function updateMomentDropdown(selectedRaceFullName) {
        if (!momentFilterSelect) return;
        while (momentFilterSelect.options.length > 1) {
            momentFilterSelect.remove(1);
        }
        momentFilterSelect.disabled = true;

        if (selectedRaceFullName && selectedRaceFullName !== 'all') {
            const encodedEventName = encodeURIComponent(selectedRaceFullName);
            fetch(window.ajaxEndpoints.getMoments.replace('RACE_PLACEHOLDER', encodedEventName))
                .then(response => {
                    if (!response.ok) throw new Error('Network response for moments was not ok');
                    return response.json();
                })
                .then(data => {
                    console.log(data.moments[0])
                    if (data.success && data.moments && Array.isArray(data.moments) && data.moments.length > 0) {
                        data.moments.forEach(momentName => momentFilterSelect.add(new Option(momentName, momentName)));
                        momentFilterSelect.disabled = false;
                    } else {
                        momentFilterSelect.disabled = true;
                    }
                })
                .catch(error => {
                    console.error('Lỗi fetch moments:', error);
                    momentFilterSelect.disabled = true;
                });
        } else {
            momentFilterSelect.disabled = (selectedRaceFullName === 'all');
        }
    }

    function updatePagination(totalItems, currentPage, type) {
        const totalPages = Math.ceil(totalItems / (type == 'races' ? 9 : 15));
        // console.log(totalItems, type)
        const paginationContainer = document.createElement('nav');
        paginationContainer.className = 'mt-4';
        const paginationList = document.createElement('ul');
        paginationList.className = 'pagination justify-content-center';

        // Xoá phân trang cũ nếu có
        const existingPagination = document.querySelector('.pagination-container');
        if (existingPagination) existingPagination.remove()

        if (totalPages <= 1) return;


        // Nút previous
        const prevItems = document.createElement('li');
        prevItems.className = 'page-item' + (currentPage == 1 ? ' disabled' : '');
        prevItems.innerHTML = `<a class="page-link" href="#">« < </a>`;
        if (currentPage > 1) {
            prevItems.addEventListener('click', (e) => {
                e.preventDefault();
                // fetchAndDisplayPhotos(currentPage - 1);
                displayCachedPage(currentPage - 1, type);
            })
        }
        paginationList.appendChild(prevItems);


        const currentPageItem = document.createElement('li');
        currentPageItem.className = 'page-item current-page';
        currentPageItem.innerHTML = `<span class="page-link">${currentPage}</span>`;
        paginationList.appendChild(currentPageItem)
         

        const nextItem = document.createElement('li');
        nextItem.className = 'page-item' + (currentPage == totalPages ? ' disabled' : '');
        nextItem.innerHTML = `<a class="page-link" href="#"> > »</a>`;
        if (currentPage < totalPages) {
            nextItem.addEventListener('click', (e) => {
                e.preventDefault();
                // fetchAndDisplayPhotos(currentPage + 1);
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
        const cacheKey = `${page}_${filterState.raceEvent}_${filterState.momentFilter}_${filterState.bibNumber}`;
        const cachedData = pageCache.get(cacheKey);
        if (cachedData) {
            renderPage(cachedData, page, type);
        }
        else {
            fetchAndDisplayPhotos(page);
        }
    }

    function renderPage(data, page, type) {
        imageGridContainer.innerHTML = '';
        if (data.success) {
            if (data.type == "races") {
                resultsTitle.textContent = "Khám phá các giải chạy";
                if (data.races && Array.isArray(data.races) && data.races.length > 0) {
                    data.races.forEach(race => {
                        const raceCard = document.createElement('div');
                        raceCard.className = 'race-summary-card';
                        raceCard.dataset.raceName = race.name;
                        const coverImg = document.createElement('img');
                        coverImg.className = 'race-cover-image';
                        // coverImg.src = race.cover_image_url;
                        coverImg.src = window.ajaxEndpoints.serveImage.replace('PATH_PLACEHOLDER', encodeURIComponent(race.cover_image_url));
                        // console.log(race.cover_image_url);
                        coverImg.alt = `Ảnh bìa ${race.name}`;
                        
                        const raceInfoDiv = document.createElement('div');
                        raceInfoDiv.className = 'race-summary-info';
                        raceInfoDiv.innerHTML = `
                            <h3>${race.name}</h3>
                            <p><small><i class="fas fa-calendar-alt"></i> Ngày: ${race.date || 'N/A'}</small></p>
                            <p><small><i class="fas fa-map-marker-alt"></i> Địa điểm: ${race.location || 'N/A'}</small></p>
                        `;
                        raceCard.appendChild(coverImg);
                        raceCard.appendChild(raceInfoDiv);
                        imageGridContainer.appendChild(raceCard);
                    });

                    updatePagination(data.total_races, page, "races");
                } else {
                    resultsTitle.textContent = "Thông báo";
                    noResultsMessage.style.display = 'block';
                    noResultsMessage.querySelector('p:first-of-type').textContent = data.message || 'Không có giải chạy nào để hiển thị.';
                }
            } else if (data.type == "images") {
                let titleText = "Kết quả tìm kiếm";
                if (data.bib_number) {
                    titleText = `Kết quả cho BIB ${data.bib_number}`;
                    if (data.race_event_filter && data.race_event_filter !== 'all') titleText += ` trong giải ${data.race_event_filter}`;
                } else if (data.race_event_filter && data.race_event_filter !== 'all') {
                    titleText = `Ảnh từ giải ${data.race_event_filter}`;
                } else if (data.race_event_filter == "all") {
                    titleText = "Ảnh mới nhất";
                }
                if (data.moment_filter && data.moment_filter !== 'all') titleText += ` tại khoảnh khắc ${data.moment_filter}`;
                resultsTitle.textContent = titleText;

                if (data.images && Array.isArray(data.images) && data.images.length > 0) {
                    data.images.forEach(imgObj => {
                        // console.log(data.images.length)
                        const imageCard = document.createElement('div');
                        imageCard.className = 'image-card';
                        const imgTag = document.createElement('img');
                        imgTag.className = 'thumbnail-image';
                        // console.log(imgObj.image_url)
                        imgTag.src = window.ajaxEndpoints.serveImage.replace('PATH_PLACEHOLDER', encodeURIComponent(imgObj.image_url));
                        imgTag.alt = `Ảnh BIB ${data.bib_number || ''} - Giải: ${imgObj.race_event_name || 'N/A'}, Khoảnh khắc: ${imgObj.moment_name || 'N/A'}`;
                        imgTag.dataset.fullsizeUrl = imgTag.src;
                        imgTag.dataset.filename = imgObj.original_filename || imgObj.image_url.split('/').pop();
                        const imageInfoDiv = document.createElement('div');
                        imageInfoDiv.className = 'image-info';
                        imageInfoDiv.innerHTML = `
                            <p><strong>Giải chạy:</strong> ${imgObj.race_event_name || 'N/A'}</p>
                            <p><strong>Moment:</strong> ${imgObj.moment_name || 'N/A'}</p>
                            ${imgObj.bibs && imgObj.bibs.length > 0 ? `<p><small>BIBs: ${imgObj.bibs.join(', ')}</small></p>` : ''}
                        `;
                        imageCard.appendChild(imgTag);
                        imageCard.appendChild(imageInfoDiv);
                        imageGridContainer.appendChild(imageCard);
                    });
                    attachThumbnailClickListeners();
                    updatePagination(data.total_images, page, "images");
                } else {
                    noResultsMessage.style.display = 'block';
                    noResultsMessage.querySelector('p:first-of-type').textContent = data.message || 'Không tìm thấy ảnh nào phù hợp.';
                }
            } else {
                resultsTitle.textContent = "Lỗi";
                noResultsMessage.style.display = 'block';
                noResultsMessage.querySelector('p:first-of-type').textContent = data.message || 'Có lỗi xảy ra từ máy chủ.';
            }
        }
    }

    function preloadNearbyPages(currentPage, totalPages, type) {
        const bibNumber = document.getElementById('bib_number').value.trim() || '';
        const raceEvent = raceEventFilter.value || "all";
        const momentValue = momentFilterSelect.value || "all";
        
        // Tiền tải trang trước
        if (currentPage > 1 && !pageCache.has(currentPage - 1)) {
            const queryParamsPrev = new URLSearchParams({
                bib_number: bibNumber,
                race_event_filter: raceEvent,
                moment_filter: momentValue,
                page: currentPage - 1,
                per_page: bibNumber || raceEvent !== "all" ? 15 : 9
            });
            fetch(`${window.ajaxEndpoints.search}?${queryParamsPrev.toString()}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) pageCache.set(currentPage - 1, data);
            })
            .catch(error => console.error("Lỗi tiền tải trang"));
        }

        // Tiền tải trang sau
        if (currentPage < totalPages && !pageCache.has(currentPage + 1)) {
            const queryParamsNext = new URLSearchParams({
                bib_number: bibNumber,
                race_event_filter: raceEvent,
                moment_filter: momentValue,
                page: currentPage + 1,
                per_page: bibNumber || raceEvent !== 'all' ? 15 : 9
            });
            fetch(`${window.ajaxEndpoints.search}?${queryParamsNext.toString()}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) pageCache.set(currentPage + 1, data);
                })
                .catch(error => console.error('Lỗi tiền tải trang sau:', error));
        }

    }

    // --- Hàm thực hiện tìm kiếm ảnh bằng AJAX ---
    function fetchAndDisplayPhotos(page = 1) {
        const bibNumber = document.getElementById('bib_number').value.trim();
        const raceEvent = raceEventFilter.value;
        const momentValue = momentFilterSelect.value;

        filterState.bibNumber = bibNumber;
        filterState.raceEvent = raceEvent;
        filterState.momentFilter = momentValue;

        ajaxLoadingIndicator.style.display = 'block';
        imageGridContainer.innerHTML = '';
        noResultsMessage.style.display = 'none';
        toggleSearchButtonState(true);

        const queryParams = new URLSearchParams({
            bib_number: bibNumber,
            race_event_filter: raceEvent,
            moment_filter: momentValue,
            page: page,
            per_page: (bibNumber || raceEvent !== "all") ? 15 : 9
        });

        const cacheKey = `${page}_${raceEvent}_${momentValue}_${bibNumber}`;
        fetch(`${window.ajaxEndpoints.search}?${queryParams.toString()}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response for photos was not ok');
                return response.json();
            })
            .then(data => {
                ajaxLoadingIndicator.style.display = 'none';
                toggleSearchButtonState(false);
                if (data.success) {
                    pageCache.set(cacheKey, data);
                    renderPage(data, page, (bibNumber || raceEvent !== "all") ? "images" : "races");
                }
            })
            .catch(error => {
                console.error('Lỗi fetch photos/races:', error);
                ajaxLoadingIndicator.style.display = 'none';
                toggleSearchButtonState(false);
                resultsTitle.textContent = "Lỗi kết nối";
                noResultsMessage.style.display = 'block';
                noResultsMessage.querySelector('p:first-of-type').textContent = 'Không thể kết nối tới máy chủ hoặc có lỗi xảy ra khi tải dữ liệu.';
            });
    }

    // Gắn sự kiện cho form
    if (photoSearchForm) {
        photoSearchForm.addEventListener('submit', function(event) {
            event.preventDefault();
            fetchAndDisplayPhotos(1);
        });
    }

    // Gắn sự kiện cho dropdown giải chạy
    if (raceEventFilter) {
        raceEventFilter.addEventListener('change', function() {
            updateMomentDropdown(this.value);
            fetchAndDisplayPhotos(1);
        });
    }

    // Gắn sự kiện cho dropdown khoảnh khắc
    // if (momentFilterSelect) {
    //     momentFilterSelect.addEventListener('change', function() {
    //         fetchAndDisplayPhotos();
    //     });
    // }

    // Cập nhật dropdown khoảnh khắc cho giá trị mặc định
    if (raceEventFilter.value && raceEventFilter.value !== 'all') {
        updateMomentDropdown(raceEventFilter.value);
    }

    imageGridContainer.addEventListener('click', function(event) {
        const raceCard = event.target.closest('.race-summary-card');
        if (raceCard) {
            const selectedRaceName = raceCard.dataset.raceName;
            // console.log("Clicked race name:", selectedRaceName);
            if (selectedRaceName) {
                raceEventFilter.value = selectedRaceName;
                updateMomentDropdown(selectedRaceName);
                fetchAndDisplayPhotos(1);
            } else {
                console.error("data-race-name không được gán trên raceCard");
            }
        }
    });

    // Hiển thị phân trang cho dữ liệu ban đầu (races_found từ template)
    const initialRacesCount = document.querySelectorAll('.race-summary-card').length;
    const totalRaces = window.totalRaces || 0;
    if (initialRacesCount > 0 && totalRaces > 0) {
        console.log(1);
        fetchAndDisplayPhotos(1);
    } else if (!imageGridContainer.children.length && !initialRacesCount) {
        noResultsMessage.style.display = 'block';
        noResultsMessage.querySelector('p:first-of-type').textContent = 'Không có dữ liệu giải chạy hoặc ảnh để hiển thị';
    }
});