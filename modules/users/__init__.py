from flask import Blueprint
from flask import jsonify, render_template, request, flash, session, abort, send_from_directory
from .services import get_all_event, get_moment_for_event, search_images_service

import datetime
import os

user_bp = Blueprint('user',
                    __name__,
                    template_folder='view'
                    )

default_per_page = 15

@user_bp.route('/')
def user_search_page():
    admin_logged_in = 'user_id' in session and session.get('role') == 'admin'
    admin_username = session.get('username') if admin_logged_in else None

    all_races, total_races, err_races = get_all_event(page=1, per_page=default_per_page)
    if err_races:
        flash(f"Không thể lấy danh sách giải chạy: {err_races}", "error")
        all_races = []
        total_races = 0

    default_selected_race_name = "all"
    moment_for_default_event = []
    total_races = total_races if total_races is not None else 0
    return render_template('index.html',
                          races_found = all_races,
                          total_races = total_races,
                          search_term="",
                          all_races=all_races,
                          selected_race_event=default_selected_race_name,
                          moment_for_default_event=moment_for_default_event,
                          selected_moment="all",
                          admin_logged_in=admin_logged_in,
                          admin_username=admin_username,
                          current_year=datetime.datetime.now().year,
                          current_page=1,
                          per_page=default_per_page)

@user_bp.route('/ajax/search', methods=['GET'])
def ajax_search():
    bib_number = request.args.get('bib_number', "").strip()
    race_event_filter = request.args.get('race_event_filter', "all").strip()
    moment_filter = request.args.get('moment_filter', "all").strip()
    # print(search_term, selected_race_event, selected_moment)
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', default_per_page))
    except ValueError:
        return jsonify({"success": False,
                        "message": "Page hoặc per_page không hợp lệ"}), 400
    races, total_races, error = get_all_event(page=page, per_page=per_page)
    if not bib_number and race_event_filter == "all" and moment_filter == "all":
        if error:
            return jsonify({"success": False,
                            "message": error})
        return jsonify({
            'success': True,
            'type': 'races',
            'races': races,
            'total_races': total_races,
            'page': page,
            'per_page': per_page if per_page <= 9 else 9,
            'message': 'Danh sách giải chạy'
        })
    if page < 1 or per_page < 1:
        return jsonify({"success": False, 
                        "message": "Tham số page hoặc per_page phải > 0"})
    if per_page > 100:
        per_page = 100
    
    images, total_images, err_images = search_images_service(
        bib_number=bib_number, 
        race_event_filter=race_event_filter,
        moment_filter=moment_filter, 
        page=page, 
        per_page=per_page)
    if err_images:
        return jsonify({"success": False,
                        "message": f"Lỗi tìm kiếm ảnh: {err_images}"}), 500
    if not images:
        return jsonify({"success": False,
                        "message": "Không tìm thấy ảnh nào phù hợp với tiêu chí tìm kiếm",
                        "type": "images",
                        "images": [],
                        "total_images": 0})
    return jsonify({"success": True,
                        "message": "Tìm kiếm thành công",
                        "type": "images",
                        "images": images,
                        "total_images": total_images,
                        "total_races": total_races,
                        "page": page,
                        "per_page": per_page})


@user_bp.route('/get_moments_for_event/<path:event_name>')
def get_moments_for_event_ajax(event_name):
    moments, error = get_moment_for_event(event_name)
    if error:
        print("Lỗi khi lấy danh sách khoảnh khắc:", error)
        return jsonify({"success": False, 
                        'error': error,
                        "message": "Lỗi khi lấy danh sách khoảnh khắc"}), 500 
    return jsonify({"success": True,
                    'moments': moments,
                    "message": "Lấy danh sách khoảnh khắc thành công"})



images_dataset_folder = os.environ.get('IMAGES_DATASET_FOLDER', 'images_dataset')
if not os.path.exists(images_dataset_folder):
    print(f"Thư mục {images_dataset_folder} không tồn tại")
@user_bp.route('/race_photo/<path:filepath>')
def serve_image(filepath):
    safe_filepath = os.path.normpath(filepath)
    requested_path = os.path.join(images_dataset_folder, safe_filepath)

    valid_extensions = {'.jpg', '.jpeg', '.png', '.gif'}
    if not os.path.splitext(safe_filepath)[1].lower() in valid_extensions:
        print(f"Yêu cầu tệp không phải ảnh: {safe_filepath}")
        abort(400)
    if not os.path.exists(requested_path) or not os.path.isfile(requested_path):
       print("Yêu cầu đường dẫn không hợp lệ hoặc cố gắng truy cập tệp không hợp lệ")
       abort(404)
    try:
        # Thêm tiêu đề Cache-Control để thêm hiệu suất
        response = send_from_directory(images_dataset_folder, safe_filepath, as_attachment=False)
        response.headers['Cache-Control'] = 'public, max-age=86400'  # 1 ngày
        return response
    except FileNotFoundError:
        print("Tệp không tồn tại")
        abort(404)
    except Exception as e:
        print("Lỗi khi phục vụ tệp:", str(e))
        abort(500)