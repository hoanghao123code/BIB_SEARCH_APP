document.addEventListener('DOMContentLoaded', function() {
        const uploadForm = document.getElementById('uploadCoverImageForm');
        const uploadStatus = document.getElementById('uploadStatus');

        if (uploadForm) {
            uploadForm.addEventListener('submit', function(event) {
                event.preventDefault();

                const formData = new FormData(uploadForm);
                const raceName = document.getElementById('raceName').value;
                const coverImage = document.getElementById('coverImage').files[0];

                if (!raceName || !coverImage) {
                    uploadStatus.textContent = 'Vui lòng chọn giải chạy và ảnh bìa.';
                    uploadStatus.style.display = 'block';
                    uploadStatus.className = 'mt-2 text-danger';
                    return;
                }

                fetch(window.ajaxEndpoints.uploadCoverImage, {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    // console.log(data.success)
                    if (data.success) {
                        uploadStatus.textContent = 'Tải ảnh bìa thành công!';
                        uploadStatus.className = 'mt-2 text-success';
                        setTimeout(() => {
                            uploadStatus.style.display = 'none';
                            location.reload(); // Tải lại trang để cập nhật ảnh
                        }, 2000);
                    } else {
                        uploadStatus.textContent = data.message || 'Lỗi khi tải ảnh bìa.';
                        uploadStatus.className = 'mt-2 text-danger';
                    }
                    uploadStatus.style.display = 'block';
                })
                .catch(error => {
                    console.error('Lỗi tải ảnh:', error);
                    uploadStatus.textContent = 'Lỗi kết nối. Vui lòng thử lại.';
                    uploadStatus.className = 'mt-2 text-danger';
                    uploadStatus.style.display = 'block';
                });
            });
        }
    });