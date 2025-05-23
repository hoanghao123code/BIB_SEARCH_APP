document.addEventListener('DOMContentLoaded', () => {
    const userTableBody = document.getElementById('userTableBody');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const btnEdit = document.getElementById('btnEdit');
    const btnChangePassword = document.getElementById('btnChangePassword');
    const btnDelete = document.getElementById('btnDelete');
    const roleFilter = document.getElementById('roleFilter');

    // Các elements cho modal (lấy một lần để tái sử dụng)
    const updateUserIdInput = document.getElementById('updateUserId');
    const updateUsernameInput = document.getElementById('updateUsername');
    const updateEmailInput = document.getElementById('updateEmail');
    const updateRoleSelect = document.getElementById('updateRole');

    const changePasswordUserIdInput = document.getElementById('changePasswordUserId');
    const newPasswordInput = document.getElementById('newPassword');
    const rePasswordInput = document.getElementById('rePassword');
    const passwordMismatchErrorDiv = document.getElementById('passwordMismatchError');

    const globalMessageDiv = document.getElementById('globalUserMessage'); // Div thông báo chung

    let selectedUserId = null;
    let currentPage = 1;
    let currentRole = ''; // Lưu trữ role đang được lọc
    // const pageCache = new Map(); // Caching với filter và cursor-based pagination có thể phức tạp, tạm thời bỏ qua để đơn giản
    // const lastDocCache = new Map();

    const perPage = 10;

    // Hàm hiển thị thông báo chung
    function showGlobalMessage(message, type = 'success') {
        if (globalMessageDiv) {
            globalMessageDiv.textContent = message;
            // Reset class và thêm class mới dựa trên type
            globalMessageDiv.className = 'alert'; // Xóa các class alert cũ
            if (type === 'success') {
                globalMessageDiv.classList.add('alert-success');
            } else if (type === 'danger') {
                globalMessageDiv.classList.add('alert-danger');
            } else if (type === 'warning') {
                globalMessageDiv.classList.add('alert-warning');
            } else {
                globalMessageDiv.classList.add('alert-info');
            }
            globalMessageDiv.style.display = 'block';

            setTimeout(() => {
                globalMessageDiv.style.display = 'none';
            }, 3000); // Tự động ẩn sau 3 giây
        } else {
            // Fallback nếu không tìm thấy div
            console.warn("globalUserMessage div not found, falling back to alert().");
            alert(message);
        }
    }


    // Hiển thị danh sách người dùng
    function renderPage(data) {
        if (!userTableBody) {
            console.error("userTableBody element not found!");
            return;
        }
        userTableBody.innerHTML = '';

        if (noResultsMessage) {
            noResultsMessage.style.display = 'none';
        }

        // Reset trạng thái lựa chọn và các nút
        selectedUserId = null;
        if (btnEdit) btnEdit.classList.add('disabled');
        if (btnChangePassword) btnChangePassword.classList.add('disabled');
        if (btnDelete) btnDelete.classList.add('disabled');

        if (data.success && data.users && Array.isArray(data.users) && data.users.length > 0) {
            data.users.forEach(user => {
                const row = document.createElement('tr');
                row.dataset.userId = user.id; // Lưu trữ userId trên row để tiện truy cập
                row.innerHTML = `
                    <td>${user.id || 'N/A'}</td>
                    <td>${user.username || 'N/A'}</td>
                    <td>${user.email || 'N/A'}</td>
                    <td>${user.role || 'N/A'}</td>
                    <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
                `;
                row.addEventListener('click', () => {
                    document.querySelectorAll('#userTableBody tr.table-active').forEach(r => r.classList.remove('table-active'));
                    row.classList.add('table-active');
                    selectedUserId = user.id;

                    // Điền thông tin vào modal Sửa
                    if (updateUserIdInput) updateUserIdInput.value = user.id;
                    if (updateUsernameInput) updateUsernameInput.value = user.username;
                    if (updateEmailInput) updateEmailInput.value = user.email;
                    if (updateRoleSelect) updateRoleSelect.value = user.role;

                    // Điền thông tin vào modal Đổi mật khẩu
                    if (changePasswordUserIdInput) changePasswordUserIdInput.value = user.id;
                    if (newPasswordInput) newPasswordInput.value = '';
                    if (rePasswordInput) rePasswordInput.value = '';
                    if (passwordMismatchErrorDiv) passwordMismatchErrorDiv.style.display = 'none';

                    if (btnEdit) btnEdit.classList.remove('disabled');
                    if (btnChangePassword) btnChangePassword.classList.remove('disabled');
                    if (btnDelete) btnDelete.classList.remove('disabled');
                });
                userTableBody.appendChild(row);
            });
            // total_users_for_filter là key mà server trả về (nếu có)
            updatePagination(data.total_users_for_filter || data.total_users, data.last_doc_id);
        } else {
            if (noResultsMessage) {
                noResultsMessage.style.display = 'block';
                noResultsMessage.querySelector('p').textContent = data.message || 'Không tìm thấy người dùng nào.';
            }
            // Xóa phân trang nếu không có kết quả
             const paginationContainer = document.getElementById('pagination-container');
            if (paginationContainer) paginationContainer.innerHTML = '';
        }
    }

    // Gửi yêu cầu lấy danh sách người dùng
    function fetchAndDisplayUsers(page = 1, lastDocId = null, roleToFetch = currentRole) {
        const queryParams = new URLSearchParams({
            page: page,
            per_page: perPage
        });
        if (lastDocId) {
            queryParams.set('last_doc_id', lastDocId);
        }
        if (roleToFetch) { // Chỉ thêm role nếu nó có giá trị
            queryParams.set('role', roleToFetch);
        }

        fetch(`${window.ajaxEndpoints.searchUsers}?${queryParams.toString()}`)
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errData => {
                        throw new Error(errData.message || `Network response was not ok: ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    currentPage = page; // Cập nhật trang hiện tại
                    // Caching (nếu cần, cân nhắc với filter và cursor)
                    // const cacheKey = `page_${page}_role_${roleToFetch || 'all'}`;
                    // pageCache.set(cacheKey, data);
                    // if (data.last_doc_id) lastDocCache.set(cacheKey, data.last_doc_id);
                    renderPage(data);
                } else {
                    showGlobalMessage(data.message || 'Lỗi tải dữ liệu người dùng.', 'danger');
                    if (userTableBody) userTableBody.innerHTML = ''; // Xóa bảng
                    const paginationContainer = document.getElementById('pagination-container');
                    if (paginationContainer) paginationContainer.innerHTML = '';
                }
            })
            .catch(error => {
                console.error('Lỗi fetch người dùng:', error);
                showGlobalMessage(`Lỗi fetch người dùng: ${error.message}`, 'danger');
                if (userTableBody) userTableBody.innerHTML = '';
                const paginationContainer = document.getElementById('pagination-container');
                if (paginationContainer) paginationContainer.innerHTML = '';
            });
    }

    // Cập nhật phân trang (đơn giản hóa cho cursor-based)
    function updatePagination(totalItems, lastDocIdForNextPage) {
        const paginationContainer = document.getElementById('pagination-container');
        if (!paginationContainer) return;
        paginationContainer.innerHTML = '';

        const totalPages = Math.ceil(totalItems / perPage);
        if (totalPages <= 1 && currentPage === 1 && (totalItems === 0 || totalItems <= perPage) ) {
             // Không hiển thị phân trang nếu chỉ có 1 trang hoặc không có item nào
            return;
        }


        const pagination = document.createElement('ul');
        pagination.className = 'pagination justify-content-center'; // Thêm justify-content-center

        // Nút Previous
        const prevItem = document.createElement('li');
        prevItem.className = 'page-item' + (currentPage <= 1 ? ' disabled' : '');
        const prevLink = document.createElement('a');
        prevLink.className = 'page-link';
        prevLink.href = '#';
        prevLink.innerHTML = '«'; // «
        if (currentPage > 1) {
            prevLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Với cursor-based, đi lùi phức tạp hơn. Cần server hỗ trợ hoặc client lưu state.
                // Tạm thời, chúng ta sẽ fetch lại trang trước đó dựa trên page number.
                // `lastDocId` cho trang trước không dễ lấy trực tiếp từ client.
                fetchAndDisplayUsers(currentPage - 1, null, currentRole);
            });
        }
        prevItem.appendChild(prevLink);
        pagination.appendChild(prevItem);

        // Hiển thị page number (tùy chọn, có thể chỉ cần Prev/Next với cursor)
        // Ví dụ đơn giản: chỉ hiển thị trang hiện tại
        const currentPageItem = document.createElement('li');
        currentPageItem.className = 'page-item active';
        currentPageItem.innerHTML = `<span class="page-link">${currentPage}</span>`;
        pagination.appendChild(currentPageItem);
        // Nếu bạn muốn hiển thị nhiều số trang hơn, logic sẽ phức tạp hơn với cursor.

        // Nút Next
        const nextItem = document.createElement('li');
        // Vô hiệu hóa Next nếu không có lastDocIdForNextPage (nghĩa là không còn trang sau)
        // hoặc nếu trang hiện tại là trang cuối dựa trên totalItems
        let isLastPage = currentPage >= totalPages;
        if (!lastDocIdForNextPage && currentPage < totalPages && totalItems > perPage * currentPage) {
            // Trường hợp này có thể xảy ra nếu server không trả về last_doc_id dù còn trang
            // Dựa vào totalItems để quyết định
        } else if (!lastDocIdForNextPage) {
            isLastPage = true; // Nếu không có last_doc_id và không còn items, chắc chắn là trang cuối
        }


        nextItem.className = 'page-item' + (isLastPage ? ' disabled' : '');
        const nextLink = document.createElement('a');
        nextLink.className = 'page-link';
        nextLink.href = '#';
        nextLink.innerHTML = '»'; // »
        if (!isLastPage) {
            nextLink.addEventListener('click', (e) => {
                e.preventDefault();
                fetchAndDisplayUsers(currentPage + 1, lastDocIdForNextPage, currentRole);
            });
        }
        nextItem.appendChild(nextLink);
        pagination.appendChild(nextItem);

        paginationContainer.appendChild(pagination);
    }

    // Lọc theo vai trò
    if (roleFilter) {
        roleFilter.addEventListener('change', () => {
            currentRole = roleFilter.value;
            currentPage = 1; // Reset về trang 1
            // pageCache.clear(); // Nếu dùng cache
            // lastDocCache.clear();
            fetchAndDisplayUsers(currentPage, null, currentRole); // Gọi với role mới, không cần lastDocId
        });
    }

    // Xử lý nút Sửa (chủ yếu để kiểm tra selectedUserId, vì modal đã được điền)
    if (btnEdit) {
        btnEdit.addEventListener('click', () => {
            if (!selectedUserId) {
                showGlobalMessage("Vui lòng chọn một người dùng để sửa.", 'warning');
                // Ngăn modal mở nếu Bootstrap không tự làm (nếu không dùng data-bs-toggle)
                // const modal = bootstrap.Modal.getInstance(document.getElementById('updateUserModal'));
                // if (modal) modal.hide();
            }
            // Modal sẽ được Bootstrap tự động mở qua data-bs-toggle
        });
    }

    // Xử lý nút Đổi mật khẩu
    if (btnChangePassword) {
        btnChangePassword.addEventListener('click', () => {
            if (!selectedUserId) {
                showGlobalMessage("Vui lòng chọn một người dùng để đổi mật khẩu.", 'warning');
            }
            // Modal sẽ được Bootstrap tự động mở
        });
    }

    // Xử lý nút Xóa
    if (btnDelete) {
        btnDelete.addEventListener('click', () => {
            if (selectedUserId) {
                if (confirm('Bạn có chắc chắn muốn xóa người dùng này không?')) {
                    fetch(window.ajaxEndpoints.deleteUser, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: selectedUserId })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showGlobalMessage(data.message, 'success');
                            // Fetch lại trang hiện tại hoặc trang 1 tùy logic bạn muốn
                            fetchAndDisplayUsers(currentPage, null, currentRole);
                        } else {
                            showGlobalMessage('Lỗi: ' + data.message, 'danger');
                        }
                    })
                    .catch(error => {
                        console.error('Lỗi xóa người dùng:', error);
                        showGlobalMessage('Có lỗi xảy ra khi xóa người dùng.', 'danger');
                    });
                }
            } else {
                showGlobalMessage("Vui lòng chọn một người dùng để xóa.", 'warning');
            }
        });
    }

    // Xử lý form cập nhật người dùng
    const updateUserForm = document.getElementById('updateUserForm');
    if (updateUserForm) {
        updateUserForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const userId = updateUserIdInput.value;
            const username = updateUsernameInput.value;
            const email = updateEmailInput.value;
            const role = updateRoleSelect.value;

            fetch(window.ajaxEndpoints.updateUser, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, username, email, role })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showGlobalMessage(data.message, 'success');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('updateUserModal'));
                    if (modal) modal.hide();
                    // Fetch lại để cập nhật bảng
                    fetchAndDisplayUsers(currentPage, null, currentRole);
                } else {
                    showGlobalMessage('Lỗi: ' + data.message, 'danger');
                }
            })
            .catch(error => {
                console.error('Lỗi cập nhật người dùng:', error);
                showGlobalMessage('Có lỗi xảy ra khi cập nhật người dùng.', 'danger');
            });
        });
    }

    // Xử lý form đổi mật khẩu
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const userId = changePasswordUserIdInput.value;
            const newPassword = newPasswordInput.value;
            const rePassword = rePasswordInput.value;

            if (newPassword !== rePassword) {
                if (passwordMismatchErrorDiv) passwordMismatchErrorDiv.style.display = 'block';
                return;
            }
            if (passwordMismatchErrorDiv) passwordMismatchErrorDiv.style.display = 'none';

            fetch(window.ajaxEndpoints.changeUserPassword, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, new_password: newPassword })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showGlobalMessage(data.message, 'success');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
                    if (modal) modal.hide();
                    // Không cần fetch lại bảng vì mật khẩu không hiển thị
                } else {
                    showGlobalMessage('Lỗi: ' + data.message, 'danger');
                }
            })
            .catch(error => {
                console.error('Lỗi đổi mật khẩu:', error);
                showGlobalMessage('Có lỗi xảy ra khi đổi mật khẩu.', 'danger');
            });
        });
    }

    // Tải danh sách người dùng ban đầu
    fetchAndDisplayUsers(currentPage, null, currentRole);
});