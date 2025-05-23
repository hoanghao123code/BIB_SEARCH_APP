document.addEventListener('DOMContentLoaded', function() {
    const updateRaceForm = document.getElementById('updateRaceForm');
    const raceNameSelect = document.getElementById('raceName');
    const newRaceNameInput = document.getElementById('newRaceName');
    const locationInput = document.getElementById('location');
    const dateInput = document.getElementById('date');
    const coverImageInput = document.getElementById('coverImage');
    const updateStatus = document.getElementById('updateStatus');
    const updateButtons = document.querySelectorAll('.update-race-btn');

    // Hàm tiện ích
    function showStatus(message, isSuccess) {
        updateStatus.style.display = 'block';
        updateStatus.className = 'mt-2 ' + (isSuccess ? 'text-success' : 'text-danger');
        updateStatus.textContent = message;
        setTimeout(() => {
            updateStatus.style.display = 'none';
        }, 5000);
    }

    function populateForm(raceName, date, location) {
        newRaceNameInput.value = raceName;
        locationInput.value = location || '';
        dateInput.value = date || '';
        coverImageInput.value = ''; // Reset file input
    }

    // Gắn sự kiện cho dropdown
    if (raceNameSelect) {
        raceNameSelect.addEventListener('change', function() {
            const selectedRace = this.value;
            if (selectedRace) {
                const raceCard = document.querySelector(`[data-race-name="${selectedRace}"]`);
                if (raceCard) {
                    const date = raceCard.getAttribute('data-race-date');
                    const location = raceCard.getAttribute('data-race-location');
                    populateForm(selectedRace, date, location);
                }
            } else {
                populateForm('', '', '');
            }
        });
    }

    // Gắn sự kiện cho nút "Cập nhật" trên danh sách
    updateButtons.forEach(button => {
        button.addEventListener('click', function() {
            const raceName = this.getAttribute('data-race-name');
            const date = this.getAttribute('data-race-date');
            const location = this.getAttribute('data-race-location');
            raceNameSelect.value = raceName;
            populateForm(raceName, date, location);
        });
    });

    // Xử lý submit form
    if (updateRaceForm) {
        updateRaceForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const formData = new FormData();
            formData.append('race_name', raceNameSelect.value);
            formData.append('new_race_name', newRaceNameInput.value);
            formData.append('location', locationInput.value);
            formData.append('date', dateInput.value);
            if (coverImageInput.files[0]) {
                formData.append('cover_image', coverImageInput.files[0]);
            }

            fetch(window.ajaxEndpoints.updateRace, {
                method: 'POST',
                body: formData,
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showStatus(data.message, true);
                    setTimeout(() => {
                        window.location.reload(); // Tải lại trang để cập nhật danh sách
                    }, 2000);
                } else {
                    showStatus(data.message, false);
                }
            })
            .catch(error => {
                console.error('Lỗi cập nhật giải chạy:', error);
                showStatus('Có lỗi mạng hoặc lỗi không xác định khi cập nhật.', false);
            });
        });
    }
});