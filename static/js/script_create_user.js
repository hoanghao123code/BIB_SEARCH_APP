document.addEventListener('DOMContentLoaded', function() {
    const createUserForm = document.getElementById('createUserFormAjax');
    const submitButton = document.getElementById('createUserSubmitButton');
    const ajaxMessageDiv = document.getElementById('ajaxCreateUserMessage');
    
    // Lấy icon và spinner từ nút (nếu có)
    const submitIcon = submitButton ? submitButton.querySelector('.fa-check-circle') : null;
    const submitSpinner = submitButton ? submitButton.querySelector('.spinner-border-sm') : null;

    if (createUserForm && submitButton && ajaxMessageDiv) {
        createUserForm.addEventListener('submit', function(event) {
            event.preventDefault(); // Ngăn chặn submit form truyền thống

            // Vô hiệu hóa nút và hiển thị spinner
            submitButton.disabled = true;
            submitButton.classList.add('btn-submitting'); // Thêm class để ẩn icon, hiện spinner
            if(submitIcon) submitIcon.style.display = 'none';
            if(submitSpinner) submitSpinner.style.display = 'inline-block';
            
            ajaxMessageDiv.style.display = 'none'; // Ẩn thông báo cũ
            ajaxMessageDiv.className = 'alert'; // Reset class của thông báo

            const formData = new FormData(createUserForm);

            fetch(createUserForm.action, {
                method: 'POST',
                body: formData,
                headers: { // Thêm header để server biết đây là AJAX request
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => {
                // Khôi phục lại nút submit dù thành công hay thất bại
                console.log('Response status:', response.status);
                submitButton.disabled = false;
                submitButton.classList.remove('btn-submitting');
                if(submitIcon) submitIcon.style.display = 'inline-block';
                if(submitSpinner) submitSpinner.style.display = 'none';
                
                return response.json().then(data => ({ status: response.status, body: data }));
            })
            .then(({ status, body }) => {
                ajaxMessageDiv.textContent = body.message;
                if (status >= 200 && status < 300 && body.success) { // Thành công
                    ajaxMessageDiv.classList.add('alert-success');
                    createUserForm.reset(); // Xóa các trường trong form sau khi thành công
                } else { // Lỗi
                    ajaxMessageDiv.classList.add('alert-danger');
                }
                ajaxMessageDiv.style.display = 'block';
            })
            .catch(error => {
                console.error('Lỗi AJAX khi tạo user:', error);
                submitButton.disabled = false; // Nhớ khôi phục nút nếu có lỗi mạng
                submitButton.classList.remove('btn-submitting');
                if(submitIcon) submitIcon.style.display = 'inline-block';
                if(submitSpinner) submitSpinner.style.display = 'none';

                ajaxMessageDiv.textContent = 'Có lỗi xảy ra. Vui lòng thử lại.';
                ajaxMessageDiv.className = 'alert alert-danger';
                ajaxMessageDiv.style.display = 'block';
            });
        });
    }
});