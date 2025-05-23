document.addEventListener('DOMContentLoaded', function() {
    const uploadZipForm = document.getElementById('uploadZipForm');
    const uploadZipSubmitButton = document.getElementById('uploadZipSubmitButton');
    const uploadZipAjaxMessage = document.getElementById('uploadZipAjaxMessage');
    const uploadZipIcon = uploadZipSubmitButton ? uploadZipSubmitButton.querySelector('.fa-cloud-upload-alt') : null;
    const uploadZipSpinner = uploadZipSubmitButton ? uploadZipSubmitButton.querySelector('.spinner-border-sm') : null;

    // Hàm tiện ích (giống như trước)
    function setButtonLoading(button, icon, spinner, isLoading) { /* ... */ }
    function showAjaxMessage(element, message, isSuccess) { /* ... */ }
    function hideAjaxMessage(element) { /* ... */ }
    
    // Dán lại các hàm tiện ích setButtonLoading, showAjaxMessage, hideAjaxMessage ở đây
    // (Hoặc tốt hơn là đặt chúng trong một file JS riêng và import vào admin_base.html)

    function setButtonLoading(button, icon, spinner, isLoading) {
        if (!button) return;
        button.disabled = isLoading;
        button.classList.toggle('btn-submitting', isLoading);
        if (icon) icon.style.display = isLoading ? 'none' : 'inline-block';
        if (spinner) spinner.style.display = isLoading ? 'inline-block' : 'none';
    }

    function showAjaxMessage(element, message, isSuccess) {
        if (!element) return;
        // Xử lý message có thể chứa \n
        const messageLines = message.split('\\n');
        element.innerHTML = ''; // Xóa nội dung cũ
        messageLines.forEach(line => {
            const p = document.createElement('p');
            p.style.marginBottom = '0.25rem'; // Khoảng cách nhỏ giữa các dòng
            p.textContent = line;
            element.appendChild(p);
        });

        element.className = 'ajax-message alert'; // Reset class
        element.classList.add(isSuccess ? 'alert-success' : 'alert-danger');
        element.style.display = 'block';

        setTimeout(() => {
            hideAjaxMessage(element);
        }, 5000);
    }

    function hideAjaxMessage(element) {
        if (!element) return;
        element.style.display = 'none';
        element.innerHTML = ''; // Đổi từ textContent sang innerHTML để xóa <p>
        element.className = 'ajax-message alert';
    }


    if (uploadZipForm && uploadZipSubmitButton && uploadZipAjaxMessage) {
        uploadZipForm.addEventListener('submit', function(event) {
            event.preventDefault();
            setButtonLoading(uploadZipSubmitButton, uploadZipIcon, uploadZipSpinner, true);
            hideAjaxMessage(uploadZipAjaxMessage);

            const formData = new FormData(uploadZipForm);
            fetch(window.ajaxEndpoint.adminUploadZipRoute, {
                method: 'POST',
                body: formData,
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            })
            .then(response => response.json().then(data => ({ status: response.status, body: data })))
            .then(({ status, body }) => {
                setButtonLoading(uploadZipSubmitButton, uploadZipIcon, uploadZipSpinner, false);
                showAjaxMessage(uploadZipAjaxMessage, body.message, body.success);
                if (body.success) {
                    uploadZipForm.reset();
                }
            })
            .catch(error => {
                console.error('Lỗi Upload ZIP AJAX:', error);
                setButtonLoading(uploadZipSubmitButton, uploadZipIcon, uploadZipSpinner, false);
                showAjaxMessage(uploadZipAjaxMessage, 'Có lỗi mạng hoặc lỗi không xác định khi tải lên.', false);
            });
        });
    }
});