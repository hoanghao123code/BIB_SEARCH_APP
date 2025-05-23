document.addEventListener('DOMContentLoaded', function() {
        const deleteButtons = document.querySelectorAll('.delete-race-btn');
        const ajaxMessage = document.getElementById('ajaxMessage');

        // Hàm hiển thị thông báo
        function showAjaxMessage(message, isSuccess) {
            ajaxMessage.style.display = 'block';
            ajaxMessage.className = `alert ${isSuccess ? 'alert-success' : 'alert-danger'}`;
            ajaxMessage.textContent = message;
            setTimeout(() => {
                ajaxMessage.style.display = 'none';
            }, 5000);
        }

        // Gắn sự kiện cho các nút xóa
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const eventName = this.getAttribute('data-event-name');
                if (!confirm('Bạn có chắc chắn muốn xóa giải chạy này và tất cả ảnh liên quan?')) return;

                fetch(window.ajaxEndpoints.adminDeleteRace, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event_name: eventName })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.closest('tr').remove();
                        showAjaxMessage(data.message, true);
                    } else {
                        showAjaxMessage(data.message, false);
                    }
                })
                .catch(error => {
                    showAjaxMessage('Đã có lỗi xảy ra: ' + error.message, false);
                });
            });
        });
    });