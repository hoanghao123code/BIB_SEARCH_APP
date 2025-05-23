from flask import Blueprint, render_template, request, flash, redirect, url_for, session, jsonify
from werkzeug.utils import secure_filename
from .services import upload_folder_zip_service, authentication_admin_user, create_user_service, upload_cover_service
from .services import manage_images_service, manage_races_service, delete_image_service, delete_race_service, update_race_service, get_moment_service, search_image_service
from .services import manage_user_service, update_user_service, change_password_service, delete_user_service, search_user_service
import  os
import uuid
import datetime
import re
from functools import wraps
from ..users.services import get_all_event

admin_bp = Blueprint('admin',
                     __name__,
                     template_folder='view',
                     url_prefix='/admin')

@admin_bp.route('/',methods=['GET'])
def load_images():
    pass

def admin_login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'role' not in session or session['role'] != 'admin':
            allowed_endpoints = ['admin.admin_login_route']
            if request.endpoint and request.endpoint not in allowed_endpoints:
                flash("Bạn cần đăng nhập với quyền admin để tải ảnh lên")
                return redirect(url_for('admin.admin_login_route'), next=request.url_rule.endpoint if request.url_rule else None)
        return f(*args, **kwargs)
    return decorated_function


@admin_bp.route('/login', methods=['GET', 'POST'])
def admin_login_route():
    if session.get('user_role') == "admin":
        return redirect(url_for("admin.admin_panel_route"))
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        data_user = authentication_admin_user(username, password)
        if data_user:
            if data_user['role'] == "admin":
                session['user_id'] = data_user['id']
                session['username'] = data_user['username']
                session['role'] = data_user['role']
                flash("Đăng nhập với quyền quản trị viên thành công!", "success")
                return redirect(url_for('admin.admin_panel_route'))
            elif data_user['role'] == "user":
                session['user_id'] = data_user['id']
                session['username'] = data_user['username']
                session['role'] = data_user['role']
                return redirect(url_for('user.user_search_page'))
        else:
            flash("Tên đăng nhập hoặc mật khẩu không hợp lệ! Vui lòng thử lại")
    return render_template('login.html', 
                           title="Đăng nhập",
                           current_year=datetime.datetime.now().year)

@admin_bp.route('/panel', methods=['GET', 'POST'])
@admin_login_required
def admin_panel_route():
    admin_logged_in = 'user_id' in session and session.get('role') == 'admin'
    admin_username = session.get('username') if admin_logged_in else None
    if request.method == "POST":
        action = request.form.get('action')
        is_ajax = request.headers.get('X-Requested-With' == 'XMLHttpRequest')
        if action == "upload_zip":
            if 'zipfile' not in request.files or request.files['zipfile'] == "":
                message = "Vui lòng chọn file ZIP"
                if is_ajax:
                    return jsonify(success=False, message=message), 400
                flash(message, 'warning-message')
            else:
                zip_file = request.files['zipfile']
                race_event_name = request.form.get('race_event_name', '').strip()
                if not race_event_name:
                    message = "Vui lòng nhập tên giải chạy"
                    if is_ajax:
                        return jsonify(success=False, message=message), 400
                    flash(message, 'warning-message')
                else:
                    message, status_code = upload_folder_zip_service(zip_file, race_event_name)
                    message_success = status_code == 200
                    if is_ajax:
                        return jsonify(success=message_success, message=message)
                    else:
                        flash(message, "success" if status_code == 200 else "error")
            return redirect(url_for('admin.admin_panel_route'))
        elif action == "create_user":
            username = request.form.get('username')
            password = request.form.get('password')
            email = request.form.get('email')
            role = request.form.get('role')
            repassword = request.form.get('repassword')
            if not username or not password or not email or not role:
                flash("Vui lòng điền đầy đủ thông tin", "warning-message")
                return redirect(request.url)
            message, status_code = create_user_service(username, password, email, role, repassword)
            flash(message, "success" if status_code == 200 else "error")
            return redirect(url_for('admin.admin_panel_route'))
    return render_template('admin_panel.html',
                        title="Tải ảnh",
                        admin_logged_in=admin_logged_in,
                        admin_username=admin_username,
                        current_year=datetime.datetime.now().year)

@admin_bp.route('/logout')
@admin_login_required
def admin_logout_route():
    session.pop('user_id', None)
    session.pop('username', None)
    session.pop('role', None)
    flash("Bạn đã đăng xuất thành công", 'info')
    return redirect(url_for('admin.admin_login_route'))

@admin_bp.route('/zip_upload', methods=['GET', 'POST'])
@admin_login_required
def upload_zip_route():
    admin_logged_in = 'user_id' in session and session.get('role') == 'admin'
    admin_username = session.get('username') if admin_logged_in else None
    if request.method == 'POST':
        if 'zipfile' not in request.files:
            return jsonify({"success": False,
                            "message": "Không có file ZIP nào được chọn"})
        
        zip_file = request.files['zipfile']

        if zip_file.filename == "":
            return jsonify({"success": False,
                            "message": "Vui lòng chọn file ZIP"})
        if not zip_file or not zip_file.filename.endswith('.zip'):
            return jsonify({"success": False,
                            "message": "Vui lòng chọn file ZIP hợp lệ"})
        race_event_name = request.form.get('race_event_name', '').strip()
        if race_event_name == "":
            return jsonify({"success": False,
                            "message": "Vui lòng nhập tên giải chạy"})
        try:
            message, status_code = upload_folder_zip_service(zip_file, race_event_name)
            if status_code == 200:
                return jsonify({"success": True,
                                "message": f"Tải ảnh lên và xử lí thành công cho giải chạy {race_event_name}"})
            return jsonify({"success": False,
                            "message": f"Có lỗi xảy ra trong quá trình tải và xử lí ảnh cho giải chạy {race_event_name}"})
        except Exception as e:
            return jsonify({"success": False,
                            "message": f"Có lỗi xảy ra: {str(e)}"})
        
@admin_bp.route('/create_user', methods=['GET', 'POST'])
@admin_login_required
def create_user_route():
    admin_logged_in = 'user_id' in session and session.get('role') == 'admin'
    admin_username = session.get('username') if admin_logged_in else None
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        email = request.form.get('email')
        role = request.form.get('role')
        repassword = request.form.get('repassword')
        print(username, password, email, role, repassword)
        password_regex = r'^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$'
        username_regex = r'^[a-zA-Z0-9_]{3,}$'
        error_message = None
        if re.fullmatch(username_regex, username) is None:
            error_message = "Tên người dung phải từ 3 ký tự trở lên và chỉ chứa chữ cái, số và dấu gạch dưới"
        if re.fullmatch(password_regex, password) is None:
            error_message = "Mật khẩu phải có ít nhất 8 ký tự, bao gồm ít nhất một chữ cái và một số"
        if password != repassword:
            error_message = "Mật khẩu không khớp"
        email_regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
        if re.fullmatch(email_regex, email) is None:
            error_message = "Email không hợp lệ"
        if not password or not username or not email or not role:
            error_message = "Tên người dùng, mật khẩu, email và vai trò không được để trống"
        if role not in ["admin", "user"]:
            error_message = "Vai trò không hợp lệ"
        # print(error_message)
        if error_message:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify(success=False, message=error_message), 400
            else:
                flash(error_message, "error")
                return render_template('create_user.html', title="Tạo người dùng mới - Lỗi",
                                admin_logged_in=admin_logged_in,
                                admin_username=admin_username,
                                email=email,
                                current_year=datetime.datetime.now().year)
        # print("pass")
        message, status_code = create_user_service(username, password, role, email)
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            if status_code == 200:
                print("200")
                return jsonify(success=True, message=message), 200
            else:
                print(status_code)
                return jsonify(success=False, message=message), status_code
        else: #Non AJAX request
            flash_message = 'success_message' if status_code == 200 else 'error_message'
            if status_code == 200:
                flash(message, "success")
                return redirect(url_for('admin.admin_panel_route'))
            else:
                flash(message, "error")
                return render_template('create_user.html', title="Tạo người dùng mới - Lỗi",
                )
    return render_template('create_user.html', title="Tạo người dùng mới",
                           admin_logged_in=admin_logged_in,
                           admin_username=admin_username,
                           current_year=datetime.datetime.now().year)

@admin_bp.route('/race_management_route', methods=['GET'])
def race_management_route():
    admin_logged_in = 'user_id' in session and session.get('role') == 'admin'
    if not admin_logged_in:
        return redirect(url_for('admin.admin_login_route'))
    races, total_races, err = get_all_event(page=1, per_page=100)
    # print(len(races), err)
    if err:
        return render_template('admin_race_management.html',
                               all_races=[],
                               error=err)
    return render_template('admin_race_management.html',
                           all_races=races,
                           total_races=total_races)


def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@admin_bp.route('/upload_cover_image', methods=['POST'])
def upload_cover_image():
    if not request.files or 'cover_image' not in request.files:
        return jsonify({"success": False,
                        "message": "Không có tệp ảnh nào được gửi lên"})
    
    cover_image = request.files['cover_image']
    racename = request.form.get('race_name')
    if not racename:
        return jsonify({"success": False,
                        "message": "Vui lòng chọn giải chạy"})
    if not cover_image.filename:
        return jsonify({"success": False,
                        "message": "Tệp ảnh trống"})
    
    if not cover_image or not allowed_file(cover_image.filename):
        return jsonify({"success": False,
                        "message": 'Tệp không phải là ảnh hợp lệ (chỉ chấp nhận .jpg, .jpeg, .png, .gif).'})
    filename = secure_filename(f"{uuid.uuid4()}_{cover_image.filename}")
    root_cover_dir = os.environ.get('ROOT_COVER_DIR', 'cover_event')
    filepath = os.path.join(root_cover_dir, filename)
    status_code, err = upload_cover_service(racename=racename,
                         filepath=filepath)
    if status_code == 200:
        root_dataset = os.environ.get('IMAGES_DATASET_FOLDER', 'images_dataset')
        file_save = os.path.join(root_dataset, filepath)
        cover_image.save(file_save)
        return jsonify({"success": True,
                    "message": "Cập nhật ảnh bìa thành công"})
    else:
        return jsonify({"success": False,
                        "message": f"Cập nhật ảnh bìa không thành công, {err}"})



@admin_bp.route('/manage_images', methods=['GET'])
def manage_images_route():
    admin_logged_in = 'user_id' in session and session.get('role') == 'admin'
    admin_username = session.get('username') if admin_logged_in else None
    all_races = []
    images = []
    total_images = 0
    status_code, all_races, images, total_images = manage_images_service()
    # print(status_code, len(all_races), len(images), total_images)
    if status_code == 200:
       print("Lấy danh sách giải chạy thành công")
    else:
       print("Lỗi khi lấy danh sách giải chạy")
    return render_template('manage_images.html',
                           all_races=all_races,
                           images=images,
                           total_images=total_images,
                           admin_logged_in=admin_logged_in,
                           admin_username=admin_username,
                           current_year=datetime.datetime.now().year)

@admin_bp.route('/search_images_route', methods=['GET'])
@admin_login_required
def search_images_route():
    race_event_filter = request.args.get('race_event_filter', "all")
    moment_filter = request.args.get('moment_filter', "all")
    last_doc_id = request.args.get('last_doc_id', None)
    per_page = request.args.get('per_page', 15)
    status_code, images, total_images, last_doc_id = search_image_service(
        race_event_filter=race_event_filter,
        moment_filter=moment_filter,
        last_doc_id=last_doc_id,
        per_page=per_page
    )
    if status_code == 200:
        return jsonify({"success": True,
                        "type": "images",
                        "images": images,
                        "total_images": total_images,
                        "last_doc_id": last_doc_id,
                        "race_event_filter": race_event_filter,
                        "moment_filter": moment_filter,
                        "message": "Ok" if images else "Không tìm thấy ảnh nào phù hợp"
                        })
    return jsonify({"success": False,
                    "message": "Lỗi hiển thị ảnh"})

@admin_bp.route('/delete_image', methods=['DELETE'])
@admin_login_required
def delete_image_route():
    image_id = request.json.get('image_id')
    if not image_id:
        return jsonify({"success": False,
                        "message": "Thiếu image id"})
    status_code, message = delete_image_service(image_id=image_id)
    if status_code == 200:
        return jsonify({"success": True, 
                        "message": message})
    return jsonify({"success": False,
                    "message": message})

@admin_bp.route('/manage_races', methods=['GET'])
@admin_login_required
def manage_races_route():
    admin_logged_in = 'user_id' in session and session.get('role') == 'admin'
    admin_username = session.get('username') if admin_logged_in else None
    status_code, races = manage_races_service()
    if status_code == 200:
        print("Lấy danh sách giải chạy thành công")
    else:
        print("Lấy danh sách giải chạy thất bại")
    return render_template('manage_races.html',
                           races=races,
                           admin_logged_in=admin_logged_in,
                           admin_username=admin_username,
                           current_year=datetime.datetime.now().year)

@admin_bp.route('/delete_race', methods=['POST'])
@admin_login_required
def delete_race_route():
    event_name = request.json.get('event_name')
    if not event_name:
        return jsonify({"success": False,
                        "message": "Không tìm thấy giải chạy"})
    status_code, message = delete_race_service(event_name=event_name)
    if status_code == 200:
        return jsonify({"success": True,
                       "message": f"Xoá giải chạy {event_name} thành công"})
    return jsonify({"success": False,
                    "message": f"Lỗi khi xoá giải chạy {event_name}"})


@admin_bp.route('/update_event', methods=['POST'])
@admin_login_required
def update_race_route():
    race_name = request.form.get('race_name')
    new_race_name = request.form.get('new_race_name')
    location = request.form.get('location')
    date = request.form.get('date')
    cover_image = None
    if 'cover_image' in request.files:
        cover_image = request.files.get('cover_image')
    status_code, message = update_race_service(
        race_name=race_name,
        new_race_name=new_race_name,
        location=location,
        date=date,
        cover_image=cover_image
    )
    if status_code == 200:
        return jsonify({"success": True,
                        "message": message})
    return jsonify({"success": False,
                    "message": message})
        
@admin_bp.route('/get_moment_route/<race_name>', methods=['GET'])
@admin_login_required
def get_moments_route(race_name):
    moments, message = get_moment_service(race_name=race_name)
    if len(moments) > 0:
        return jsonify({"success": True,
                        "moments": moments,
                        "message": message})
    return jsonify({"success": False,
                    "message": message})


@admin_bp.route('/manage_users_route', methods=['GET'])
@admin_login_required
def manage_users_route():
    admin_logged_in = 'user_id' in session and session.get('role') == 'admin'
    admin_username = session.get('username') if admin_logged_in else None
    status_code, users, total_users = manage_user_service()
    return render_template('manage_users.html',
                           users=users,
                           total_users=total_users,
                           admin_logged_in=admin_logged_in,
                           admin_username=admin_username,
                           current_year=datetime.datetime.now().year)

@admin_bp.route('/search_users_route', methods=['GET'])
@admin_login_required
def search_users_route():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 15))
    last_doc_id = request.args.get('last_doc_id')
    role = request.args.get('role')
    status_code, users, total_users = search_user_service(
        role=role,
        page=page,
        per_page=per_page,
        last_doc_id=last_doc_id
    )
    if status_code == 200:
        return jsonify({"success": True,
                        "type": "users",
                        "users": users,
                        "total_users": total_users,
                        "message": "Ok" if users else "Không tìm thấy người dùng nào"})
    return jsonify({"success": False,
                    "message": "Không tìm thấy người dùng nào"})

@admin_bp.route('/update_users', methods=['POST'])
@admin_login_required
def update_user_route():
    user_id = request.json.get('user_id')
    username = request.json.get('username')
    email = request.json.get('email')
    role = request.json.get('role')
    status_code, message = update_user_service(
        user_id=user_id,
        user_name=username,
        email=email,
        role=role
    )
    if status_code == 200:
        return jsonify({"success": True,
                        "message": "Cập nhật user thành công"})
    return jsonify({"success": False,
                    "message": "Cập nhật người dùng không thành công"})

@admin_bp.route('/change_password_route', methods=['POST'])
@admin_login_required
def change_password_route():
    user_id = request.json.get('user_id')
    new_password = request.json.get('new_password')

    status_code, message = change_password_service(
        usee_id=user_id,
        newpassword=new_password
    )
    if status_code == 200:
        return jsonify({"success": True,
                        "message": message})
    return jsonify({"success": False,
                    "message": message})

@admin_bp.route('/delete_user_route', methods=['POST'])
@admin_login_required
def delete_user_route():
    user_id = request.json.get('user_id')
    status_code, message = delete_user_service(
        user_id=user_id
    )
    if status_code == 200:
        return jsonify({"success": True,
                        "message": message})
    return jsonify({"success": False,
                    "message": message})