
from flask import Flask, render_template, request, jsonify, session, send_file
from flask_sqlalchemy import SQLAlchemy
from datetime import date, datetime, time, timedelta
from decimal import Decimal
import os
import io
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
import tempfile

# Inicialización de Flask
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', '1234')

# Configuración de la base de datos
DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL:
    # Producción - Render proporciona DATABASE_URL automáticamente
    # Convertir postgresql:// a postgresql+psycopg:// para psycopg3
    if DATABASE_URL.startswith('postgresql://'):
        DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+psycopg://', 1)
    elif DATABASE_URL.startswith('postgres://'):
        DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql+psycopg://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    # Desarrollo - conectar directo a tu base en Render con psycopg3
    #app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql+psycopg://alquifiestas_user:OGKpbEmUIefuJ2R8YRJ8AUo7ZmlfNFW1@dpg-d2me99ogjchc73ci0mf0-a.oregon-postgres.render.com:5432/alquifiestas'

     app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql+psycopg://alquifiestas_user:8mLAXVU1ugv5u75TtDq59i1je7rkMv3D@dpg-d3cvghl6ubrc73f5o4mg-a.oregon-postgres.render.com:5432/alquifiestas_5zn7'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ===============================================
# FUNCIONES AUXILIARES PARA BASE DE DATOS
# ===============================================

from datetime import date, datetime, time
from decimal import Decimal

def authenticate_user(username, password):
    """Función para autenticar usuario (solo admin y empleados)"""
    try:
        cursor = db.session.connection().connection.cursor()
        cursor.execute("""
            SELECT id, username, email, full_name, user_type, is_active
            FROM users 
            WHERE username = %s AND password = %s AND is_active = true
            AND user_type IN ('admin', 'empleado')
        """, (username, password))
        
        result = cursor.fetchone()
        if result:
            columns = ['id', 'username', 'email', 'full_name', 'user_type', 'is_active']
            user_data = dict(zip(columns, result))
            
            # Actualizar último login
            cursor.execute("""
                UPDATE users 
                SET last_login = CURRENT_TIMESTAMP 
                WHERE id = %s
            """, (user_data['id'],))
            db.session.commit()
            
            return user_data
        return None
    except Exception as e:
        print(f"Error en authenticate_user: {str(e)}")
        return None

def create_employee(username, password, email, full_name, telefono='', direccion='', cargo=''):
    """Función para crear nuevo empleado"""
    try:
        cursor = db.session.connection().connection.cursor()
        
        # Verificar si el usuario ya existe
        cursor.execute("""
            SELECT id FROM users 
            WHERE username = %s OR email = %s
        """, (username, email))
        
        if cursor.fetchone():
            return None
        
        # Crear nuevo usuario tipo empleado
        cursor.execute("""
            INSERT INTO users (username, email, password, full_name, user_type)
            VALUES (%s, %s, %s, %s, 'empleado')
            RETURNING id
        """, (username, email, password, full_name or username))
        
        user_id = cursor.fetchone()[0]
        
        # Crear registro en tabla empleados
        cursor.execute("""
            INSERT INTO empleados (user_id, nombre, telefono, direccion, cargo)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, full_name or username, telefono, direccion, cargo))
        
        db.session.commit()
        return user_id
        
    except Exception as e:
        db.session.rollback()
        print(f"Error en create_employee: {str(e)}")
        return None

def create_admin(username, password, email, full_name, telefono='', direccion=''):
    """Función para crear nuevo administrador"""
    try:
        cursor = db.session.connection().connection.cursor()
        
        # Verificar si el usuario ya existe
        cursor.execute("""
            SELECT id FROM users 
            WHERE username = %s OR email = %s
        """, (username, email))
        
        if cursor.fetchone():
            return None
        
        # Crear nuevo usuario tipo admin
        cursor.execute("""
            INSERT INTO users (username, email, password, full_name, user_type)
            VALUES (%s, %s, %s, %s, 'admin')
            RETURNING id
        """, (username, email, password, full_name or username))
        
        user_id = cursor.fetchone()[0]
        
        # Crear registro en tabla administradores
        cursor.execute("""
            INSERT INTO administradores (user_id, nombre, telefono, direccion)
            VALUES (%s, %s, %s, %s)
        """, (user_id, full_name or username, telefono, direccion))
        
        db.session.commit()
        return user_id
        
    except Exception as e:
        db.session.rollback()
        print(f"Error en create_admin: {str(e)}")
        return None

def get_user_info(user_id):
    """Obtener información completa del usuario"""
    try:
        cursor = db.session.connection().connection.cursor()
        cursor.execute("""
            SELECT u.*, 
                   e.id_empleado, e.telefono as empleado_telefono, 
                   e.direccion as empleado_direccion, e.cargo,
                   a.id_admin, a.telefono as admin_telefono, 
                   a.direccion as admin_direccion
            FROM users u
            LEFT JOIN empleados e ON u.id = e.user_id
            LEFT JOIN administradores a ON u.id = a.user_id
            WHERE u.id = %s
        """, (user_id,))
        
        columns = [desc[0] for desc in cursor.description]
        result = cursor.fetchone()
        
        if result:
            return dict(zip(columns, result))
        return None
        
    except Exception as e:
        print(f"Error obteniendo info usuario: {str(e)}")
        return None

# ===============================================
# RUTAS BÁSICAS
# ===============================================

@app.route('/')
def index():
    return render_template('login.html')

@app.route('/register_page')
def register_page():
    return render_template('register.html')

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({
                'success': False,
                'message': 'Usuario y contraseña son requeridos'
            }), 400
        
        user_data = authenticate_user(username, password)
        
        if user_data:
            session['user'] = username
            session['user_id'] = user_data['id']
            session['user_name'] = user_data['full_name']
            session['user_type'] = user_data['user_type']
            session['is_admin'] = user_data['user_type'] == 'admin'
            session['is_empleado'] = user_data['user_type'] == 'empleado'
            
            # Obtener ID específico según el tipo
            cursor = db.session.connection().connection.cursor()
            
            if session['is_empleado']:
                cursor.execute("SELECT id_empleado FROM empleados WHERE user_id = %s", (user_data['id'],))
                empleado = cursor.fetchone()
                if empleado:
                    session['empleado_id'] = empleado[0]
            elif session['is_admin']:
                cursor.execute("SELECT id_admin FROM administradores WHERE user_id = %s", (user_data['id'],))
                admin = cursor.fetchone()
                if admin:
                    session['admin_id'] = admin[0]
            
            return jsonify({
                'success': True,
                'message': 'Login exitoso',
                'user_type': user_data['user_type'],
                'is_admin': session['is_admin'],
                'is_empleado': session['is_empleado'],
                'redirect': '/admin_dashboard' if session['is_admin'] else '/employee_dashboard'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Usuario o contraseña incorrectos, o no tienes permisos de acceso'
            }), 401
            
    except Exception as e:
        print(f"Error en login: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error en el servidor'
        }), 500

@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        email = data.get('email')
        full_name = data.get('full_name')
        user_type = data.get('user_type', 'empleado')  # Por defecto empleado
        telefono = data.get('telefono', '')
        direccion = data.get('direccion', '')
        cargo = data.get('cargo', '')
        
        if not username or not password or not email:
            return jsonify({
                'success': False,
                'message': 'Usuario, contraseña y email son requeridos'
            }), 400
        
        # Crear usuario según el tipo
        user_id = None
        if user_type == 'admin':
            user_id = create_admin(username, password, email, full_name, telefono, direccion)
        else:
            user_id = create_employee(username, password, email, full_name, telefono, direccion, cargo)
        
        if user_id:
            return jsonify({
                'success': True,
                'message': f'{user_type.capitalize()} registrado exitosamente'
            }), 201
        else:
            return jsonify({
                'success': False,
                'message': 'Error al registrar usuario. El usuario o email ya existe.'
            }), 400
            
    except Exception as e:
        print(f"Error en register: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error en el servidor'
        }), 500

@app.route('/logout')
def logout():
    session.clear()
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    """Redirigir al dashboard apropiado según el tipo de usuario"""
    if 'user' not in session:
        return render_template('login.html')
    
    if session.get('is_admin'):
        return admin_dashboard()
    elif session.get('is_empleado'):
        return employee_dashboard()
    else:
        return render_template('login.html')

@app.route('/admin_dashboard')
def admin_dashboard():
    """Dashboard para administradores"""
    if 'user' not in session or not session.get('is_admin'):
        return render_template('login.html')
    
    user_info = {
        'username': session.get('user'),
        'name': session.get('user_name'),
        'user_type': 'admin',
        'is_admin': True
    }
    
    return render_template('admin_dashboard.html', user=user_info)

@app.route('/employee_dashboard')
def employee_dashboard():
    """Dashboard para empleados"""
    if 'user' not in session or not session.get('is_empleado'):
        return render_template('login.html')
    
    user_info = {
        'username': session.get('user'),
        'name': session.get('user_name'),
        'user_type': 'empleado',
        'is_empleado': True,
        'empleado_id': session.get('empleado_id')
    }
    
    return render_template('employee_dashboard.html', user=user_info)

# ===============================================
# RUTAS API PARA GESTIÓN DE CLIENTES
# ===============================================

@app.route('/api/clientes', methods=['GET'])
def get_clientes():
    """Obtener lista de clientes (solo para admin/empleados)"""
    if 'user' not in session:
        return jsonify({'success': False, 'message': 'No autorizado'}), 401
    
    try:
        cursor = db.session.connection().connection.cursor()
        cursor.execute("""
            SELECT c.id_cliente, c.nombre, c.telefono, c.direccion, c.notas,
                   u.email, u.created_at, u.is_active
            FROM clientes c
            LEFT JOIN users u ON c.user_id = u.id
            ORDER BY c.nombre
        """)
        
        columns = [desc[0] for desc in cursor.description]
        results = cursor.fetchall()
        
        clientes = [dict(zip(columns, row)) for row in results]
        
        return jsonify({
            'success': True,
            'clientes': clientes
        })
        
    except Exception as e:
        print(f"Error obteniendo clientes: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo clientes'
        }), 500

@app.route('/api/clientes', methods=['POST'])
def create_cliente():
    """Crear nuevo cliente (solo para admin/empleados)"""
    if 'user' not in session:
        return jsonify({'success': False, 'message': 'No autorizado'}), 401
    
    try:
        data = request.get_json()
        nombre = data.get('nombre')
        telefono = data.get('telefono', '')
        direccion = data.get('direccion', '')
        email = data.get('email', '')
        notas = data.get('notas', '')
        
        if not nombre:
            return jsonify({
                'success': False,
                'message': 'El nombre es requerido'
            }), 400
        
        cursor = db.session.connection().connection.cursor()
        
        # Crear cliente sin usuario asociado (solo registro de datos)
        cursor.execute("""
            INSERT INTO clientes (nombre, telefono, direccion, notas, user_id)
            VALUES (%s, %s, %s, %s, NULL)
            RETURNING id_cliente
        """, (nombre, telefono, direccion, notas))
        
        cliente_id = cursor.fetchone()[0]
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Cliente creado exitosamente',
            'cliente_id': cliente_id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creando cliente: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error creando cliente'
        }), 500

@app.route('/api/empleados', methods=['GET'])
def get_empleados():
    """Obtener lista de empleados (solo para admin)"""
    if 'user' not in session or not session.get('is_admin'):
        return jsonify({'success': False, 'message': 'No autorizado'}), 401
    
    try:
        cursor = db.session.connection().connection.cursor()
        cursor.execute("""
            SELECT e.id_empleado, e.nombre, e.telefono, e.direccion, e.cargo, 
                   e.fecha_ingreso, u.email, u.username, u.is_active
            FROM empleados e
            JOIN users u ON e.user_id = u.id
            ORDER BY e.nombre
        """)
        
        columns = [desc[0] for desc in cursor.description]
        results = cursor.fetchall()
        
        empleados = [dict(zip(columns, row)) for row in results]
        
        return jsonify({
            'success': True,
            'empleados': empleados
        })
        
    except Exception as e:
        print(f"Error obteniendo empleados: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo empleados'
        }), 500

# ===============================================
# VERIFICACIÓN DE PERMISOS
# ===============================================

def require_login(f):
    """Decorador para requerir login"""
    def wrapper(*args, **kwargs):
        if 'user' not in session:
            return render_template('login.html')
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

def require_admin(f):
    """Decorador para requerir permisos de administrador"""
    def wrapper(*args, **kwargs):
        if 'user' not in session or not session.get('is_admin'):
            return jsonify({'success': False, 'message': 'Acceso denegado'}), 403
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

# ===============================================
# INICIALIZACIÓN
# ===============================================

def verify_database_connection():
    """Verificar conexión a base de datos"""
    try:
        cursor = db.session.connection().connection.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        print("Conexión a base de datos exitosa")
        return True
    except Exception as e:
        print(f"Error conectando a base de datos: {str(e)}")
        return False

# Inicializar aplicación
try:
    with app.app_context():
        if verify_database_connection():
            print("Base de datos lista para usar")
        else:
            print("Error en conexión a base de datos")
except Exception as e:
    print(f"Error inicializando aplicación: {str(e)}")

# ===============================================
# FUNCIONES AUXILIARES
# ===============================================

def require_login():
    """Verificar si el usuario está logueado"""
    if 'user' not in session:
        return jsonify({'success': False, 'message': 'No autorizado'}), 401
    return None

def get_empleado_id():
    """Obtener ID del empleado actual"""
    return session.get('empleado_id')

def get_user_id():
    """Obtener ID del usuario actual"""
    return session.get('user_id')

# ===============================================
# ENDPOINTS DASHBOARD Y ESTADÍSTICAS
# ===============================================

@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        empleado_id = get_empleado_id()
        
        # Total eventos este mes
        cursor.execute("""
            SELECT COUNT(*) FROM eventos 
            WHERE EXTRACT(MONTH FROM fecha_evento) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(YEAR FROM fecha_evento) = EXTRACT(YEAR FROM CURRENT_DATE)
            AND (id_empleado_asignado = %s OR %s IS NULL)
        """, (empleado_id, empleado_id))
        total_eventos = cursor.fetchone()[0]
        
        # Eventos hoy
        cursor.execute("""
            SELECT COUNT(*) FROM eventos 
            WHERE fecha_evento = CURRENT_DATE
            AND (id_empleado_asignado = %s OR %s IS NULL)
        """, (empleado_id, empleado_id))
        eventos_hoy = cursor.fetchone()[0]
        
        # Cotizaciones pendientes
        cursor.execute("""
            SELECT COUNT(*) FROM cotizaciones 
            WHERE estado IN ('borrador', 'enviada')
            AND (id_empleado = %s OR %s IS NULL)
        """, (empleado_id, empleado_id))
        cotizaciones_pendientes = cursor.fetchone()[0]
        
        # Total clientes
        cursor.execute("SELECT COUNT(*) FROM clientes")
        total_clientes = cursor.fetchone()[0]
        
        return jsonify({
            'success': True,
            'total_eventos': total_eventos,
            'eventos_hoy': eventos_hoy,
            'cotizaciones_pendientes': cotizaciones_pendientes,
            'total_clientes': total_clientes
        })
        
    except Exception as e:
        print(f"Error obteniendo estadísticas: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo estadísticas'
        }), 500

# ===============================================
# ENDPOINTS EVENTOS
# ===============================================
@app.route('/api/eventos', methods=['GET'])
def get_eventos():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        empleado_id = get_empleado_id()
        
        # Obtener parámetros de filtro
        estado = request.args.get('estado')
        fecha_inicio = request.args.get('fecha_inicio')
        fecha_fin = request.args.get('fecha_fin')
        
        # Query base
        query = """
            SELECT e.id_evento, e.numero_evento, e.fecha_evento, e.hora_inicio, e.hora_fin,
                   e.lugar_evento, e.numero_invitados, e.estado, e.monto_total, e.monto_pagado,
                   e.notas, e.created_at, c.nombre as cliente_nombre, c.telefono as cliente_telefono
            FROM eventos e
            LEFT JOIN clientes c ON e.id_cliente = c.id_cliente
            WHERE 1=1
        """
        
        params = []
        
        # Filtros
        if empleado_id:
            query += " AND (e.id_empleado_asignado = %s OR e.id_empleado_asignado IS NULL)"
            params.append(empleado_id)
            
        if estado:
            query += " AND e.estado = %s"
            params.append(estado)
            
        if fecha_inicio:
            query += " AND e.fecha_evento >= %s"
            params.append(fecha_inicio)
            
        if fecha_fin:
            query += " AND e.fecha_evento <= %s"
            params.append(fecha_fin)
        
        query += " ORDER BY e.fecha_evento DESC, e.created_at DESC"
        
        cursor.execute(query, params)
        columns = [desc[0] for desc in cursor.description]
        results = cursor.fetchall()
        
        eventos = []
        for row in results:
            evento = dict(zip(columns, row))
            # Convertir Decimal a float para JSON
            if evento['monto_total']:
                evento['monto_total'] = float(evento['monto_total'])
            if evento['monto_pagado']:
                evento['monto_pagado'] = float(evento['monto_pagado'])
            # Convertir fechas y horas a string
            if evento['fecha_evento']:
                evento['fecha_evento'] = evento['fecha_evento'].isoformat()
            if evento['hora_inicio']:
                evento['hora_inicio'] = str(evento['hora_inicio'])
            if evento['hora_fin']:
                evento['hora_fin'] = str(evento['hora_fin'])
            if evento['created_at']:
                evento['created_at'] = evento['created_at'].isoformat()
            eventos.append(evento)
        
        return jsonify({
            'success': True,
            'eventos': eventos
        })
        
    except Exception as e:
        print(f"Error obteniendo eventos: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo eventos'
        }), 500

@app.route('/api/eventos/proximos', methods=['GET'])
def get_eventos_proximos():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        empleado_id = get_empleado_id()
        
        # Eventos próximos (siguientes 7 días)
        query = """
            SELECT e.id_evento, e.fecha_evento, e.hora_inicio, e.hora_fin,
                   e.lugar_evento, e.estado, c.nombre as cliente_nombre
            FROM eventos e
            LEFT JOIN clientes c ON e.id_cliente = c.id_cliente
            WHERE e.fecha_evento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
            AND e.estado NOT IN ('cancelado', 'completado')
            AND (e.id_empleado_asignado = %s OR e.id_empleado_asignado IS NULL OR %s IS NULL)
            ORDER BY e.fecha_evento ASC, e.hora_inicio ASC
            LIMIT 5
        """
        
        cursor.execute(query, (empleado_id, empleado_id))
        columns = [desc[0] for desc in cursor.description]
        results = cursor.fetchall()
        
        eventos = []
        for row in results:
            evento = dict(zip(columns, row))
            if evento['fecha_evento']:
                evento['fecha_evento'] = evento['fecha_evento'].isoformat()
            if evento['hora_inicio']:
                evento['hora_inicio'] = str(evento['hora_inicio'])
            if evento['hora_fin']:
                evento['hora_fin'] = str(evento['hora_fin'])
            eventos.append(evento)
        
        return jsonify({
            'success': True,
            'eventos': eventos
        })
        
    except Exception as e:
        print(f"Error obteniendo eventos próximos: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo eventos próximos'
        }), 500

@app.route('/api/eventos', methods=['POST'])
def create_evento():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.get_json()
        
        # Validaciones
        required_fields = ['id_cliente', 'fecha_evento']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'success': False,
                    'message': f'El campo {field} es requerido'
                }), 400
        
        cursor = db.session.connection().connection.cursor()
        empleado_id = get_empleado_id()
        
        # Generar número de evento único
        cursor.execute("SELECT COUNT(*) FROM eventos WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)")
        count = cursor.fetchone()[0] + 1
        numero_evento = f"EVT-{datetime.now().year}-{count:04d}"
        
        # Insertar evento
        cursor.execute("""
            INSERT INTO eventos (numero_evento, id_cliente, id_empleado_asignado, fecha_evento,
                               hora_inicio, hora_fin, lugar_evento, numero_invitados, notas, estado)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'reservado')
            RETURNING id_evento
        """, (
            numero_evento,
            data['id_cliente'],
            empleado_id,
            data['fecha_evento'],
            data.get('hora_inicio'),
            data.get('hora_fin'),
            data.get('lugar_evento', ''),
            data.get('numero_invitados'),
            data.get('notas', '')
        ))
        
        evento_id = cursor.fetchone()[0]
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Evento creado exitosamente',
            'evento_id': evento_id,
            'numero_evento': numero_evento
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creando evento: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error creando evento'
        }), 500

@app.route('/api/eventos/<int:evento_id>', methods=['GET'])
def get_evento_detail(evento_id):
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        
        # Obtener evento con detalles
        cursor.execute("""
            SELECT e.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono,
                   c.direccion as cliente_direccion, c.notas as cliente_notas
            FROM eventos e
            LEFT JOIN clientes c ON e.id_cliente = c.id_cliente
            WHERE e.id_evento = %s
        """, (evento_id,))
        
        columns = [desc[0] for desc in cursor.description]
        result = cursor.fetchone()
        
        if not result:
            return jsonify({
                'success': False,
                'message': 'Evento no encontrado'
            }), 404
        
        evento = dict(zip(columns, result))
        
        # Convertir tipos para JSON
        if evento['monto_total']:
            evento['monto_total'] = float(evento['monto_total'])
        if evento['monto_pagado']:
            evento['monto_pagado'] = float(evento['monto_pagado'])
        if evento['fecha_evento']:
            evento['fecha_evento'] = evento['fecha_evento'].isoformat()
        if evento['hora_inicio']:
            evento['hora_inicio'] = str(evento['hora_inicio'])
        if evento['hora_fin']:
            evento['hora_fin'] = str(evento['hora_fin'])
        if evento['created_at']:
            evento['created_at'] = evento['created_at'].isoformat()
        if evento['updated_at']:
            evento['updated_at'] = evento['updated_at'].isoformat()
        
        # Obtener artículos del evento
        cursor.execute("""
            SELECT ea.*, a.nombre_articulo, a.codigo, a.precio_unitario as precio_base
            FROM evento_articulos ea
            JOIN articulos a ON ea.id_articulo = a.id_articulo
            WHERE ea.id_evento = %s
        """, (evento_id,))
        
        articulos_columns = [desc[0] for desc in cursor.description]
        articulos_results = cursor.fetchall()
        
        articulos = []
        for row in articulos_results:
            articulo = dict(zip(articulos_columns, row))
            if articulo['precio_unitario']:
                articulo['precio_unitario'] = float(articulo['precio_unitario'])
            if articulo['precio_base']:
                articulo['precio_base'] = float(articulo['precio_base'])
            articulos.append(articulo)
        
        # Obtener servicios del evento
        cursor.execute("""
            SELECT es.*, s.nombre_servicio, s.categoria, s.precio_por_hora, s.precio_fijo
            FROM evento_servicios es
            JOIN servicios s ON es.id_servicio = s.id_servicio
            WHERE es.id_evento = %s
        """, (evento_id,))
        
        servicios_columns = [desc[0] for desc in cursor.description]
        servicios_results = cursor.fetchall()
        
        servicios = []
        for row in servicios_results:
            servicio = dict(zip(servicios_columns, row))
            if servicio['precio_unitario']:
                servicio['precio_unitario'] = float(servicio['precio_unitario'])
            if servicio['precio_por_hora']:
                servicio['precio_por_hora'] = float(servicio['precio_por_hora'])
            if servicio['precio_fijo']:
                servicio['precio_fijo'] = float(servicio['precio_fijo'])
            servicios.append(servicio)
        
        # Obtener pagos
        cursor.execute("""
            SELECT p.*, u.full_name as registrado_por_nombre
            FROM pagos p
            LEFT JOIN users u ON p.registrado_por = u.id
            WHERE p.id_evento = %s
            ORDER BY p.fecha_pago DESC
        """, (evento_id,))
        
        pagos_columns = [desc[0] for desc in cursor.description]
        pagos_results = cursor.fetchall()
        
        pagos = []
        for row in pagos_results:
            pago = dict(zip(pagos_columns, row))
            if pago['monto']:
                pago['monto'] = float(pago['monto'])
            if pago['fecha_pago']:
                pago['fecha_pago'] = pago['fecha_pago'].isoformat()
            pagos.append(pago)
        
        evento['articulos'] = articulos
        evento['servicios'] = servicios
        evento['pagos'] = pagos
        
        return jsonify({
            'success': True,
            'evento': evento
        })
        
    except Exception as e:
        print(f"Error obteniendo detalle de evento: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo detalle de evento'
        }), 500

@app.route('/api/eventos/<int:evento_id>', methods=['PUT'])
def update_evento(evento_id):
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.get_json()
        cursor = db.session.connection().connection.cursor()
        
        # Campos actualizables
        update_fields = []
        params = []
        
        if 'fecha_evento' in data:
            update_fields.append("fecha_evento = %s")
            params.append(data['fecha_evento'])
            
        if 'hora_inicio' in data:
            update_fields.append("hora_inicio = %s")
            params.append(data['hora_inicio'])
            
        if 'hora_fin' in data:
            update_fields.append("hora_fin = %s")
            params.append(data['hora_fin'])
            
        if 'lugar_evento' in data:
            update_fields.append("lugar_evento = %s")
            params.append(data['lugar_evento'])
            
        if 'numero_invitados' in data:
            update_fields.append("numero_invitados = %s")
            params.append(data['numero_invitados'])
            
        if 'estado' in data:
            update_fields.append("estado = %s")
            params.append(data['estado'])
            
        if 'notas' in data:
            update_fields.append("notas = %s")
            params.append(data['notas'])
            
        if 'monto_total' in data:
            update_fields.append("monto_total = %s")
            params.append(data['monto_total'])
        
        if not update_fields:
            return jsonify({
                'success': False,
                'message': 'No hay campos para actualizar'
            }), 400
        
        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        params.append(evento_id)
        
        query = f"UPDATE eventos SET {', '.join(update_fields)} WHERE id_evento = %s"
        cursor.execute(query, params)
        
        if cursor.rowcount == 0:
            return jsonify({
                'success': False,
                'message': 'Evento no encontrado'
            }), 404
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Evento actualizado exitosamente'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error actualizando evento: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error actualizando evento'
        }), 500

# ===============================================
# ENDPOINTS COTIZACIONES
# ===============================================

@app.route('/api/cotizaciones', methods=['GET'])
def get_cotizaciones():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        empleado_id = get_empleado_id()
        
        # Obtener parámetros de filtro
        estado = request.args.get('estado')
        
        query = """
            SELECT c.id_cotizacion, c.numero_cotizacion, c.fecha_cotizacion, c.fecha_evento,
                   c.lugar_evento, c.numero_invitados, c.monto_total, c.descuento, c.estado,
                   c.vigencia_dias, c.notas, cl.nombre as cliente_nombre
            FROM cotizaciones c
            LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
            WHERE 1=1
        """
        
        params = []
        
        if empleado_id:
            query += " AND (c.id_empleado = %s OR c.id_empleado IS NULL)"
            params.append(empleado_id)
            
        if estado:
            query += " AND c.estado = %s"
            params.append(estado)
        
        query += " ORDER BY c.fecha_cotizacion DESC"
        
        cursor.execute(query, params)
        columns = [desc[0] for desc in cursor.description]
        results = cursor.fetchall()
        
        cotizaciones = []
        for row in results:
            cotizacion = dict(zip(columns, row))
            # Convertir tipos para JSON
            if cotizacion['monto_total']:
                cotizacion['monto_total'] = float(cotizacion['monto_total'])
            if cotizacion['descuento']:
                cotizacion['descuento'] = float(cotizacion['descuento'])
            if cotizacion['fecha_cotizacion']:
                cotizacion['fecha_cotizacion'] = cotizacion['fecha_cotizacion'].isoformat()
            if cotizacion['fecha_evento']:
                cotizacion['fecha_evento'] = cotizacion['fecha_evento'].isoformat()
            cotizaciones.append(cotizacion)
        
        return jsonify({
            'success': True,
            'cotizaciones': cotizaciones
        })
        
    except Exception as e:
        print(f"Error obteniendo cotizaciones: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo cotizaciones'
        }), 500

@app.route('/api/cotizaciones', methods=['POST'])
def create_cotizacion():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.get_json()
        
        if not data.get('id_cliente'):
            return jsonify({
                'success': False,
                'message': 'El cliente es requerido'
            }), 400
        
        cursor = db.session.connection().connection.cursor()
        empleado_id = get_empleado_id()
        
        # Generar número de cotización único
        cursor.execute("SELECT COUNT(*) FROM cotizaciones WHERE EXTRACT(YEAR FROM fecha_cotizacion) = EXTRACT(YEAR FROM CURRENT_DATE)")
        count = cursor.fetchone()[0] + 1
        numero_cotizacion = f"COT-{datetime.now().year}-{count:04d}"
        
        # Insertar cotización
        cursor.execute("""
            INSERT INTO cotizaciones (numero_cotizacion, id_cliente, id_empleado, fecha_evento,
                                    hora_inicio, hora_fin, lugar_evento, numero_invitados, notas)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id_cotizacion
        """, (
            numero_cotizacion,
            data['id_cliente'],
            empleado_id,
            data.get('fecha_evento'),
            data.get('hora_inicio'),
            data.get('hora_fin'),
            data.get('lugar_evento', ''),
            data.get('numero_invitados'),
            data.get('notas', '')
        ))
        
        cotizacion_id = cursor.fetchone()[0]
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Cotización creada exitosamente',
            'cotizacion_id': cotizacion_id,
            'numero_cotizacion': numero_cotizacion
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creando cotización: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error creando cotización'
        }), 500

# ===============================================
# ENDPOINTS MEJORADOS PARA COTIZACIONES
# ===============================================

@app.route('/api/cotizaciones/completa', methods=['POST'])
def create_cotizacion_completa():
    """Crear cotización completa con artículos y servicios SIN afectar inventario"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.get_json()
        
        cursor = db.session.connection().connection.cursor()
        empleado_id = get_empleado_id()
        
        # Generar número de cotización único
        cursor.execute("SELECT COUNT(*) FROM cotizaciones WHERE EXTRACT(YEAR FROM fecha_cotizacion) = EXTRACT(YEAR FROM CURRENT_DATE)")
        count = cursor.fetchone()[0] + 1
        numero_cotizacion = f"COT-{datetime.now().year}-{count:04d}"
        
        # Insertar cotización (cliente puede ser NULL)
        cursor.execute("""
            INSERT INTO cotizaciones (numero_cotizacion, id_cliente, id_empleado, fecha_evento,
                                    hora_inicio, hora_fin, lugar_evento, numero_invitados, 
                                    monto_total, notas, estado)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'borrador')
            RETURNING id_cotizacion
        """, (
            numero_cotizacion,
            data.get('id_cliente'),  # Puede ser None
            empleado_id,
            data.get('fecha_evento'),
            data.get('hora_inicio'),
            data.get('hora_fin'),
            data.get('lugar_evento', ''),
            data.get('numero_invitados'),
            data.get('monto_total', 0),
            data.get('notas', '')
        ))
        
        cotizacion_id = cursor.fetchone()[0]
        
        # Insertar artículos de la cotización (SOLO registro, NO afecta inventario)
        articulos = data.get('articulos', [])
        for articulo in articulos:
            cursor.execute("""
                INSERT INTO cotizacion_articulos (id_cotizacion, id_articulo, cantidad, precio_unitario)
                VALUES (%s, %s, %s, %s)
            """, (
                cotizacion_id,
                articulo['id_articulo'],
                articulo['cantidad'],
                articulo['precio_unitario']
            ))
        
        # Insertar servicios de la cotización
        servicios = data.get('servicios', [])
        for servicio in servicios:
            cursor.execute("""
                INSERT INTO cotizacion_servicios (id_cotizacion, id_servicio, cantidad_horas, precio_unitario)
                VALUES (%s, %s, %s, %s)
            """, (
                cotizacion_id,
                servicio['id_servicio'],
                servicio.get('cantidad', 1),
                servicio['precio_unitario']
            ))
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Cotización creada exitosamente',
            'cotizacion_id': cotizacion_id,
            'numero_cotizacion': numero_cotizacion
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creando cotización completa: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error creando cotización: {str(e)}'
        }), 500


@app.route('/api/cotizaciones/<int:cotizacion_id>/detalle', methods=['GET'])
def get_cotizacion_completa(cotizacion_id):
    """Obtener cotización completa con artículos y servicios"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        
        # Obtener cotización básica
        cursor.execute("""
            SELECT c.*, cl.nombre as cliente_nombre, cl.telefono as cliente_telefono,
                   e.nombre as empleado_nombre
            FROM cotizaciones c
            LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
            LEFT JOIN empleados e ON c.id_empleado = e.id_empleado
            WHERE c.id_cotizacion = %s
        """, (cotizacion_id,))
        
        columns = [desc[0] for desc in cursor.description]
        result = cursor.fetchone()
        
        if not result:
            return jsonify({
                'success': False,
                'message': 'Cotización no encontrada'
            }), 404
        
        cotizacion = dict(zip(columns, result))
        
        # Convertir tipos para JSON
        if cotizacion['monto_total']:
            cotizacion['monto_total'] = float(cotizacion['monto_total'])
        if cotizacion['descuento']:
            cotizacion['descuento'] = float(cotizacion['descuento'])
        if cotizacion['fecha_cotizacion']:
            cotizacion['fecha_cotizacion'] = cotizacion['fecha_cotizacion'].isoformat()
        if cotizacion['fecha_evento']:
            cotizacion['fecha_evento'] = cotizacion['fecha_evento'].isoformat()
        
        # Obtener artículos
        cursor.execute("""
            SELECT ca.*, a.codigo, a.nombre_articulo, a.descripcion
            FROM cotizacion_articulos ca
            JOIN articulos a ON ca.id_articulo = a.id_articulo
            WHERE ca.id_cotizacion = %s
        """, (cotizacion_id,))
        
        articulos_columns = [desc[0] for desc in cursor.description]
        articulos_results = cursor.fetchall()
        
        articulos = []
        for row in articulos_results:
            articulo = dict(zip(articulos_columns, row))
            if articulo['precio_unitario']:
                articulo['precio_unitario'] = float(articulo['precio_unitario'])
            if articulo['subtotal']:
                articulo['subtotal'] = float(articulo['subtotal'])
            articulos.append(articulo)
        
        # Obtener servicios
        cursor.execute("""
            SELECT cs.*, s.codigo, s.nombre_servicio, s.descripcion
            FROM cotizacion_servicios cs
            JOIN servicios s ON cs.id_servicio = s.id_servicio
            WHERE cs.id_cotizacion = %s
        """, (cotizacion_id,))
        
        servicios_columns = [desc[0] for desc in cursor.description]
        servicios_results = cursor.fetchall()
        
        servicios = []
        for row in servicios_results:
            servicio = dict(zip(servicios_columns, row))
            if servicio['precio_unitario']:
                servicio['precio_unitario'] = float(servicio['precio_unitario'])
            if servicio['subtotal']:
                servicio['subtotal'] = float(servicio['subtotal'])
            servicios.append(servicio)
        
        cotizacion['articulos'] = articulos
        cotizacion['servicios'] = servicios
        
        return jsonify({
            'success': True,
            'cotizacion': cotizacion
        })
        
    except Exception as e:
        print(f"Error obteniendo cotización completa: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo cotización'
        }), 500


@app.route('/api/cotizaciones/<int:cotizacion_id>/aprobar', methods=['POST'])
def aprobar_cotizacion(cotizacion_id):
    """Aprobar cotización y convertirla en evento"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.get_json()
        id_cliente = data.get('id_cliente')  # Ahora sí es obligatorio
        
        if not id_cliente:
            return jsonify({
                'success': False,
                'message': 'Debe seleccionar un cliente para aprobar la cotización'
            }), 400
        
        cursor = db.session.connection().connection.cursor()
        
        # Obtener cotización
        cursor.execute("""
            SELECT * FROM cotizaciones WHERE id_cotizacion = %s
        """, (cotizacion_id,))
        
        cotizacion = cursor.fetchone()
        if not cotizacion:
            return jsonify({'success': False, 'message': 'Cotización no encontrada'}), 404
        
        # Generar número de evento
        cursor.execute("SELECT COUNT(*) FROM eventos WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)")
        count = cursor.fetchone()[0] + 1
        numero_evento = f"EVT-{datetime.now().year}-{count:04d}"
        
        # Crear evento desde la cotización
        cursor.execute("""
            INSERT INTO eventos (numero_evento, id_cotizacion, id_cliente, id_empleado_asignado,
                               fecha_evento, hora_inicio, hora_fin, lugar_evento, numero_invitados,
                               estado, monto_total, notas)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'confirmado', %s, %s)
            RETURNING id_evento
        """, (
            numero_evento,
            cotizacion_id,
            id_cliente,
            cotizacion[2],  # id_empleado
            cotizacion[4],  # fecha_evento
            cotizacion[5],  # hora_inicio
            cotizacion[6],  # hora_fin
            cotizacion[7],  # lugar_evento
            cotizacion[8],  # numero_invitados
            cotizacion[9],  # monto_total
            cotizacion[13]  # notas
        ))
        
        evento_id = cursor.fetchone()[0]
        
        # Copiar artículos de cotización a evento
        cursor.execute("""
            SELECT id_articulo, cantidad, precio_unitario
            FROM cotizacion_articulos
            WHERE id_cotizacion = %s
        """, (cotizacion_id,))
        
        articulos_cot = cursor.fetchall()
        for art in articulos_cot:
            cursor.execute("""
                INSERT INTO evento_articulos (id_evento, id_articulo, cantidad_solicitada, 
                                            precio_unitario, estado_articulo)
                VALUES (%s, %s, %s, %s, 'reservado')
            """, (evento_id, art[0], art[1], art[2]))
        
        # Copiar servicios
        cursor.execute("""
            SELECT id_servicio, cantidad_horas, precio_unitario
            FROM cotizacion_servicios
            WHERE id_cotizacion = %s
        """, (cotizacion_id,))
        
        servicios_cot = cursor.fetchall()
        for serv in servicios_cot:
            cursor.execute("""
                INSERT INTO evento_servicios (id_evento, id_servicio, horas_contratadas, precio_unitario)
                VALUES (%s, %s, %s, %s)
            """, (evento_id, serv[0], serv[1], serv[2]))
        
        # Actualizar estado de cotización
        cursor.execute("""
            UPDATE cotizaciones 
            SET estado = 'aprobada', id_evento_generado = %s
            WHERE id_cotizacion = %s
        """, (evento_id, cotizacion_id))
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Cotización aprobada y evento creado exitosamente',
            'evento_id': evento_id,
            'numero_evento': numero_evento
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error aprobando cotización: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        }), 500


# ===============================================
# ENDPOINTS ARTÍCULOS
# ===============================================

@app.route('/api/articulos', methods=['GET'])
def get_articulos():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        
        # Obtener parámetros de filtro
        categoria = request.args.get('categoria')
        busqueda = request.args.get('busqueda')
        
        query = """
            SELECT a.id_articulo, a.codigo, a.nombre_articulo, a.descripcion,
                   a.cantidad_total, a.cantidad_disponible, a.cantidad_dañada,
                   a.precio_unitario, a.costo_reposicion, a.estado,
                   c.nombre as categoria_nombre, s.nombre as subcategoria_nombre
            FROM articulos a
            LEFT JOIN categorias_articulos c ON a.id_categoria = c.id_categoria
            LEFT JOIN subcategorias_articulos s ON a.id_subcategoria = s.id_subcategoria
            WHERE a.estado = 'activo'
        """
        
        params = []
        
        if categoria:
            query += " AND a.id_categoria = %s"
            params.append(categoria)
            
        if busqueda:
            query += " AND (LOWER(a.nombre_articulo) LIKE LOWER(%s) OR LOWER(a.codigo) LIKE LOWER(%s))"
            params.extend([f"%{busqueda}%", f"%{busqueda}%"])
        
        query += " ORDER BY c.nombre, s.nombre, a.nombre_articulo"
        
        cursor.execute(query, params)
        columns = [desc[0] for desc in cursor.description]
        results = cursor.fetchall()
        
        articulos = []
        for row in results:
            articulo = dict(zip(columns, row))
            # Convertir Decimal a float para JSON
            if articulo['precio_unitario']:
                articulo['precio_unitario'] = float(articulo['precio_unitario'])
            if articulo['costo_reposicion']:
                articulo['costo_reposicion'] = float(articulo['costo_reposicion'])
            articulos.append(articulo)
        
        return jsonify({
            'success': True,
            'articulos': articulos
        })
        
    except Exception as e:
        print(f"Error obteniendo artículos: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo artículos'
        }), 500

@app.route('/api/articulos/<int:articulo_id>/movimiento', methods=['POST'])
def registrar_movimiento_articulo(articulo_id):
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.get_json()
        
        required_fields = ['tipo_movimiento', 'cantidad']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'El campo {field} es requerido'
                }), 400
        
        cursor = db.session.connection().connection.cursor()
        
        # Obtener cantidad actual
        cursor.execute("SELECT cantidad_disponible FROM articulos WHERE id_articulo = %s", (articulo_id,))
        result = cursor.fetchone()
        
        if not result:
            return jsonify({
                'success': False,
                'message': 'Artículo no encontrado'
            }), 404
        
        cantidad_anterior = result[0]
        tipo_movimiento = data['tipo_movimiento']
        cantidad = int(data['cantidad'])
        
        # Calcular nueva cantidad según el tipo de movimiento
        if tipo_movimiento in ['entrada', 'recogida', 'reparado']:
            cantidad_nueva = cantidad_anterior + cantidad
        elif tipo_movimiento in ['salida', 'entrega', 'dañado', 'perdido']:
            cantidad_nueva = cantidad_anterior - cantidad
            if cantidad_nueva < 0:
                return jsonify({
                    'success': False,
                    'message': 'No hay suficiente stock disponible'
                }), 400
        else:
            return jsonify({
                'success': False,
                'message': 'Tipo de movimiento no válido'
            }), 400
        
        # Registrar movimiento
        cursor.execute("""
            INSERT INTO movimientos_inventario (id_articulo, id_evento, tipo_movimiento, cantidad,
                                              cantidad_anterior, cantidad_nueva, responsable, observaciones)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            articulo_id,
            data.get('id_evento'),
            tipo_movimiento,
            cantidad,
            cantidad_anterior,
            cantidad_nueva,
            data.get('responsable', session.get('user_name')),
            data.get('observaciones', '')
        ))
        
        # Actualizar cantidad en artículo
        if tipo_movimiento == 'dañado':
            cursor.execute("""
                UPDATE articulos 
                SET cantidad_disponible = %s, cantidad_dañada = cantidad_dañada + %s
                WHERE id_articulo = %s
            """, (cantidad_nueva, cantidad, articulo_id))
        else:
            cursor.execute("""
                UPDATE articulos 
                SET cantidad_disponible = %s
                WHERE id_articulo = %s
            """, (cantidad_nueva, articulo_id))
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Movimiento registrado exitosamente',
            'cantidad_anterior': cantidad_anterior,
            'cantidad_nueva': cantidad_nueva
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error registrando movimiento: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error registrando movimiento'
        }), 500

# ===============================================
# ENDPOINTS PERFIL
# ===============================================

@app.route('/api/perfil', methods=['GET'])
def get_perfil():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        user_id = get_user_id()
        cursor = db.session.connection().connection.cursor()
        
        cursor.execute("""
            SELECT u.full_name, u.email, u.username, u.user_type,
                   e.nombre, e.telefono, e.direccion, e.cargo, e.fecha_ingreso
            FROM users u
            LEFT JOIN empleados e ON u.id = e.user_id
            WHERE u.id = %s
        """, (user_id,))
        
        columns = [desc[0] for desc in cursor.description]
        result = cursor.fetchone()
        
        if not result:
            return jsonify({
                'success': False,
                'message': 'Usuario no encontrado'
            }), 404
        
        perfil = dict(zip(columns, result))
        
        # Convertir fecha para JSON
        if perfil['fecha_ingreso']:
            perfil['fecha_ingreso'] = perfil['fecha_ingreso'].isoformat()
        
        return jsonify({
            'success': True,
            'perfil': perfil
        })
        
    except Exception as e:
        print(f"Error obteniendo perfil: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo perfil'
        }), 500

@app.route('/api/perfil', methods=['PUT'])
def update_perfil():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.get_json()
        user_id = get_user_id()
        cursor = db.session.connection().connection.cursor()
        
        # Actualizar en tabla empleados
        if any(field in data for field in ['telefono', 'direccion']):
            update_fields = []
            params = []
            
            if 'telefono' in data:
                update_fields.append("telefono = %s")
                params.append(data['telefono'])
                
            if 'direccion' in data:
                update_fields.append("direccion = %s")
                params.append(data['direccion'])
            
            params.append(user_id)
            
            query = f"UPDATE empleados SET {', '.join(update_fields)} WHERE user_id = %s"
            cursor.execute(query, params)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Perfil actualizado exitosamente'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error actualizando perfil: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error actualizando perfil'
        }), 500

# ===============================================
# ENDPOINTS REPORTES PDF
# ===============================================

from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image as RLImage
import os

# ===============================================
# ENDPOINTS DE REPORTES PDF MEJORADOS
# ===============================================

@app.route('/api/reportes/eventos/pdf', methods=['GET'])
def generar_reporte_eventos_pdf():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        # Obtener parámetros
        fecha_inicio = request.args.get('fecha_inicio', (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'))
        fecha_fin = request.args.get('fecha_fin', datetime.now().strftime('%Y-%m-%d'))
        estado = request.args.get('estado')
        cliente_id = request.args.get('cliente_id')
        detallado = request.args.get('detallado') == 'true'
        
        cursor = db.session.connection().connection.cursor()
        empleado_id = get_empleado_id()
        
        # Query para obtener eventos
        query = """
            SELECT e.numero_evento, e.fecha_evento, e.hora_inicio, e.hora_fin,
                   e.lugar_evento, e.estado, e.monto_total, e.monto_pagado,
                   e.saldo_pendiente, e.numero_invitados,
                   c.nombre as cliente_nombre, c.telefono as cliente_telefono,
                   emp.nombre as empleado_nombre
            FROM eventos e
            LEFT JOIN clientes c ON e.id_cliente = c.id_cliente
            LEFT JOIN empleados emp ON e.id_empleado_asignado = emp.id_empleado
            WHERE e.fecha_evento BETWEEN %s AND %s
        """
        
        params = [fecha_inicio, fecha_fin]
        
        if empleado_id:
            query += " AND (e.id_empleado_asignado = %s OR e.id_empleado_asignado IS NULL)"
            params.append(empleado_id)
            
        if estado:
            query += " AND e.estado = %s"
            params.append(estado)
            
        if cliente_id:
            query += " AND e.id_cliente = %s"
            params.append(int(cliente_id))
        
        query += " ORDER BY e.fecha_evento DESC, e.created_at DESC"
        
        cursor.execute(query, params)
        eventos = cursor.fetchall()
        
        # Crear PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=1*inch, bottomMargin=0.5*inch,
                               leftMargin=0.75*inch, rightMargin=0.75*inch)
        story = []
        
        # Estilos
        styles = getSampleStyleSheet()
        
        # Header con logo
        logo_path = 'static/alquifiestas.png'
        if os.path.exists(logo_path):
            logo = RLImage(logo_path, width=1.2*inch, height=1.2*inch)
            
            header_title = Paragraph(
                "<b>ALQUIFIESTAS LA CALZADA</b><br/>"
                "<font size=10>Teléfono: (502) 1234-5678 | Email: info@alquifiestas.com</font><br/>"
                "<font size=9>Ciudad de Guatemala</font>",
                ParagraphStyle('HeaderTitle', parent=styles['Normal'], fontSize=14, 
                             textColor=colors.HexColor('#2563EB'), alignment=2, spaceAfter=10)
            )
            
            header_data = [[logo, header_title]]
            header_table = Table(header_data, colWidths=[1.5*inch, 5*inch])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ]))
            story.append(header_table)
        else:
            company_name = Paragraph(
                "<b>ALQUIFIESTAS LA CALZADA</b>",
                ParagraphStyle('CompanyName', parent=styles['Heading1'], fontSize=20,
                             textColor=colors.HexColor('#2563EB'), alignment=1)
            )
            story.append(company_name)
        
        story.append(Spacer(1, 0.2*inch))
        
        # Línea separadora
        line_table = Table([['', '']], colWidths=[6.5*inch, 0*inch])
        line_table.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, 0), 2, colors.HexColor('#2563EB')),
        ]))
        story.append(line_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Título del reporte
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1D4ED8'),
            spaceAfter=20,
            alignment=1
        )
        title = Paragraph("<b>REPORTE DE EVENTOS</b>", title_style)
        story.append(title)
        
        # Información del reporte
        fecha_actual = datetime.now().strftime("%d/%m/%Y %H:%M")
        
        # Obtener nombre del cliente si se filtró
        cliente_nombre = "TODOS"
        if cliente_id:
            cursor.execute("SELECT nombre FROM clientes WHERE id_cliente = %s", (int(cliente_id),))
            cliente_result = cursor.fetchone()
            if cliente_result:
                cliente_nombre = cliente_result[0]
        
        info_data = [
            [Paragraph('<b>Período:</b>', styles['Normal']), 
             f"{fecha_inicio} al {fecha_fin}",
             Paragraph('<b>Generado:</b>', styles['Normal']), 
             fecha_actual],
            [Paragraph('<b>Total de eventos:</b>', styles['Normal']), 
             str(len(eventos)),
             Paragraph('<b>Estado:</b>', styles['Normal']), 
             estado.upper() if estado else 'TODOS'],
            [Paragraph('<b>Cliente:</b>', styles['Normal']),
             cliente_nombre,
             Paragraph('<b>Detallado:</b>', styles['Normal']),
             'SÍ' if detallado else 'NO']
        ]
        
        info_table = Table(info_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 1.5*inch])
        info_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.3*inch))
        
        if eventos and len(eventos) > 0:
            # Estadísticas resumidas
            total_monto = sum(float(e[6]) if e[6] else 0 for e in eventos)
            total_pagado = sum(float(e[7]) if e[7] else 0 for e in eventos)
            total_pendiente = sum(float(e[8]) if e[8] else 0 for e in eventos)
            
            stats_data = [
                ['ESTADÍSTICAS DEL PERÍODO'],
                [f'Ingresos Totales: Q{total_monto:.2f}'],
                [f'Monto Pagado: Q{total_pagado:.2f}'],
                [f'Saldo Pendiente: Q{total_pendiente:.2f}']
            ]
            
            stats_table = Table(stats_data, colWidths=[6.5*inch])
            stats_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 11),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#EFF6FF')),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#2563EB')),
            ]))
            story.append(stats_table)
            story.append(Spacer(1, 0.3*inch))
            
            # Crear tabla de eventos
            if detallado:
                # Modo detallado con más información
                data = [['Número', 'Cliente', 'Fecha', 'Horario', 'Lugar', 'Invitados', 'Estado', 'Monto', 'Pagado', 'Pendiente']]
                
                for evento in eventos:
                    fecha_evento = evento[1].strftime('%d/%m/%Y') if evento[1] else ''
                    horario = f"{str(evento[2])[:5] if evento[2] else '--:--'} - {str(evento[3])[:5] if evento[3] else '--:--'}"
                    monto_total = float(evento[6]) if evento[6] else 0
                    monto_pagado = float(evento[7]) if evento[7] else 0
                    saldo_pendiente = float(evento[8]) if evento[8] else 0
                    
                    data.append([
                        evento[0] or '',
                        evento[10] or '',
                        fecha_evento,
                        horario,
                        evento[4][:20] + '...' if evento[4] and len(evento[4]) > 20 else (evento[4] or ''),
                        str(evento[9]) if evento[9] else '-',
                        evento[5] or '',
                        f"Q{monto_total:.2f}",
                        f"Q{monto_pagado:.2f}",
                        f"Q{saldo_pendiente:.2f}"
                    ])
                
                table = Table(data, colWidths=[0.8*inch, 1*inch, 0.8*inch, 0.8*inch, 1.2*inch, 0.6*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.7*inch])
            else:
                # Modo resumido
                data = [['Número', 'Cliente', 'Fecha', 'Lugar', 'Estado', 'Monto Total', 'Pagado']]
                
                for evento in eventos:
                    monto_total = float(evento[6]) if evento[6] else 0
                    monto_pagado = float(evento[7]) if evento[7] else 0
                    
                    fecha_evento = evento[1].strftime('%d/%m/%Y') if evento[1] else ''
                    
                    data.append([
                        evento[0] or '',
                        evento[10] or '',
                        fecha_evento,
                        evento[4] or '',
                        evento[5] or '',
                        f"Q{monto_total:.2f}",
                        f"Q{monto_pagado:.2f}"
                    ])
                
                table = Table(data, colWidths=[1*inch, 1.3*inch, 0.9*inch, 1.3*inch, 0.9*inch, 1*inch, 1*inch])
            
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('FONTSIZE', (0, 1), (-1, -1), 7),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
            ]))
            
            story.append(table)
            
            # Totales finales
            story.append(Spacer(1, 0.2*inch))
            totales_data = [
                ['', '', '', '', Paragraph('<b>TOTALES:</b>', styles['Normal']), 
                 Paragraph(f"<b>Q{total_monto:.2f}</b>", styles['Normal']), 
                 Paragraph(f"<b>Q{total_pagado:.2f}</b>", styles['Normal'])]
            ]
            
            if detallado:
                totales_data = [[
                    '', '', '', '', '', '', '',
                    Paragraph(f"<b>Q{total_monto:.2f}</b>", styles['Normal']),
                    Paragraph(f"<b>Q{total_pagado:.2f}</b>", styles['Normal']),
                    Paragraph(f"<b>Q{total_pendiente:.2f}</b>", styles['Normal'])
                ]]
            
            totales_table = Table(totales_data, colWidths=[1*inch, 1.3*inch, 0.9*inch, 1.3*inch, 0.9*inch, 1*inch, 1*inch] if not detallado else [0.8*inch, 1*inch, 0.8*inch, 0.8*inch, 1.2*inch, 0.6*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.7*inch])
            totales_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#E5E7EB')),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(totales_table)
            
        else:
            no_data = Paragraph(
                "<i>No se encontraron eventos en el período especificado con los filtros aplicados.</i>",
                ParagraphStyle('NoData', parent=styles['Normal'], alignment=1, textColor=colors.grey)
            )
            story.append(no_data)
        
        # Footer
        story.append(Spacer(1, 0.3*inch))
        footer = Paragraph(
            f"<i>Reporte generado el {fecha_actual}</i>",
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, 
                         alignment=1, textColor=colors.grey)
        )
        story.append(footer)
        
        # Generar PDF
        doc.build(story)
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f'reporte_eventos_{fecha_inicio}_al_{fecha_fin}.pdf',
            mimetype='application/pdf'
        )
        
    except Exception as e:
        print(f"Error generando reporte PDF: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Error generando reporte PDF: {str(e)}'
        }), 500

@app.route('/api/reportes/inventario/pdf', methods=['GET'])
def generar_reporte_inventario_pdf():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        # Obtener parámetros
        categoria = request.args.get('categoria')
        stock_bajo = request.args.get('stock_bajo') == 'true'
        valorizacion = request.args.get('valorizacion') == 'true'
        daniados = request.args.get('daniados') == 'true'
        
        cursor = db.session.connection().connection.cursor()
        
        # Obtener inventario actual
        query = """
            SELECT a.codigo, a.nombre_articulo, a.cantidad_total, a.cantidad_disponible,
                   a.cantidad_dañada, a.precio_unitario, a.costo_reposicion,
                   c.nombre as categoria_nombre
            FROM articulos a
            LEFT JOIN categorias_articulos c ON a.id_categoria = c.id_categoria
            WHERE a.estado = 'activo'
        """
        
        params = []
        
        if categoria:
            query += " AND a.id_categoria = %s"
            params.append(int(categoria))
        
        query += " ORDER BY c.nombre, a.nombre_articulo"
        
        cursor.execute(query, params)
        articulos = cursor.fetchall()
        
        # Crear PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=1*inch, bottomMargin=0.5*inch,
                               leftMargin=0.75*inch, rightMargin=0.75*inch)
        story = []
        
        # Estilos
        styles = getSampleStyleSheet()
        
        # Header con logo
        logo_path = 'static/alquifiestas.png'
        if os.path.exists(logo_path):
            logo = RLImage(logo_path, width=1.2*inch, height=1.2*inch)
            
            header_title = Paragraph(
                "<b>ALQUIFIESTAS LA CALZADA</b><br/>"
                "<font size=10>Teléfono: (502) 1234-5678 | Email: info@alquifiestas.com</font><br/>"
                "<font size=9>Ciudad de Guatemala</font>",
                ParagraphStyle('HeaderTitle', parent=styles['Normal'], fontSize=14, 
                             textColor=colors.HexColor('#2563EB'), alignment=2, spaceAfter=10)
            )
            
            header_data = [[logo, header_title]]
            header_table = Table(header_data, colWidths=[1.5*inch, 5*inch])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ]))
            story.append(header_table)
        else:
            company_name = Paragraph(
                "<b>ALQUIFIESTAS LA CALZADA</b>",
                ParagraphStyle('CompanyName', parent=styles['Heading1'], fontSize=20,
                             textColor=colors.HexColor('#2563EB'), alignment=1)
            )
            story.append(company_name)
        
        story.append(Spacer(1, 0.2*inch))
        
        # Línea separadora
        line_table = Table([['', '']], colWidths=[6.5*inch, 0*inch])
        line_table.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, 0), 2, colors.HexColor('#10B981')),
        ]))
        story.append(line_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Título del reporte
        title = Paragraph(
            "<b>REPORTE DE INVENTARIO</b>",
            ParagraphStyle('ReportTitle', parent=styles['Heading1'], fontSize=18,
                         textColor=colors.HexColor('#059669'), spaceAfter=20, alignment=1)
        )
        story.append(title)
        
        # Información del reporte
        fecha_actual = datetime.now().strftime("%d/%m/%Y %H:%M")
        
        # Obtener nombre de categoría si se filtró
        categoria_nombre = "TODAS"
        if categoria:
            cursor.execute("SELECT nombre FROM categorias_articulos WHERE id_categoria = %s", (int(categoria),))
            cat_result = cursor.fetchone()
            if cat_result:
                categoria_nombre = cat_result[0]
        
        info_data = [
            [Paragraph('<b>Generado:</b>', styles['Normal']), fecha_actual,
             Paragraph('<b>Total de artículos:</b>', styles['Normal']), str(len(articulos))],
            [Paragraph('<b>Categoría:</b>', styles['Normal']), categoria_nombre,
             Paragraph('<b>Incluye dañados:</b>', styles['Normal']), 'SÍ' if daniados else 'NO']
        ]
        
        info_table = Table(info_data, colWidths=[1.5*inch, 2*inch, 1.8*inch, 1.2*inch])
        info_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.3*inch))
        
        if articulos and len(articulos) > 0:
            # Estadísticas
            total_articulos = len(articulos)
            stock_total = sum(a[2] or 0 for a in articulos)
            stock_disponible = sum(a[3] or 0 for a in articulos)
            articulos_bajo_stock = sum(1 for a in articulos if (a[3] or 0) < 10)
            valor_total = sum((float(a[5]) if a[5] else 0) * (a[2] or 0) for a in articulos)
            
            stats_data = [
                ['RESUMEN DEL INVENTARIO'],
                [f'Total de Artículos: {total_articulos}'],
                [f'Stock Total: {stock_total} unidades'],
                [f'Stock Disponible: {stock_disponible} unidades'],
                [f'Artículos con Stock Bajo: {articulos_bajo_stock}'],
            ]
            
            if valorizacion:
                stats_data.append([f'Valorización Total: Q{valor_total:,.2f}'])
            
            stats_table = Table(stats_data, colWidths=[6.5*inch])
            stats_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10B981')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 11),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#ECFDF5')),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#10B981')),
            ]))
            story.append(stats_table)
            story.append(Spacer(1, 0.3*inch))
            
            # Crear tabla
            if valorizacion:
                data = [['Código', 'Artículo', 'Categoría', 'Stock Total', 'Disponible', 'Dañados', 'Precio Unit.', 'Valor Total']]
            else:
                data = [['Código', 'Artículo', 'Categoría', 'Stock Total', 'Disponible', 'Dañados', 'Precio Unit.']]
            
            for articulo in articulos:
                precio = float(articulo[5]) if articulo[5] else 0
                cantidad_total = articulo[2] or 0
                cantidad_disponible = articulo[3] or 0
                cantidad_danada = articulo[4] or 0
                valor_total_item = precio * cantidad_total
                
                # Marcar en rojo si stock bajo
                codigo_cell = articulo[0] or ''
                nombre_cell = articulo[1] or ''
                
                if stock_bajo and cantidad_disponible < 10:
                    # Marcar con color de alerta
                    row_data = [
                        codigo_cell,
                        nombre_cell,
                        articulo[7] or '',
                        str(cantidad_total),
                        str(cantidad_disponible),
                        str(cantidad_danada) if daniados else '-',
                        f"Q{precio:.2f}"
                    ]
                    
                    if valorizacion:
                        row_data.append(f"Q{valor_total_item:.2f}")
                    
                    data.append(row_data)
                else:
                    row_data = [
                        codigo_cell,
                        nombre_cell,
                        articulo[7] or '',
                        str(cantidad_total),
                        str(cantidad_disponible),
                        str(cantidad_danada) if daniados else '-',
                        f"Q{precio:.2f}"
                    ]
                    
                    if valorizacion:
                        row_data.append(f"Q{valor_total_item:.2f}")
                    
                    data.append(row_data)
            
            # Fila de total
            if valorizacion:
                data.append(['', '', '', '', '', 
                            Paragraph('<b>VALOR TOTAL:</b>', styles['Normal']), 
                            '',
                            Paragraph(f"<b>Q{valor_total:,.2f}</b>", styles['Normal'])])
                
                col_widths = [0.7*inch, 1.8*inch, 1*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.9*inch]
            else:
                col_widths = [0.8*inch, 2*inch, 1.1*inch, 0.8*inch, 0.8*inch, 0.7*inch, 0.9*inch]
            
            table = Table(data, colWidths=col_widths)
            
            # Estilos de tabla con filas alternadas
            table_style = [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10B981')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
            ]
            
            # Aplicar color de fondo alternado
            for i in range(1, len(data) - 1):
                if i % 2 == 0:
                    table_style.append(('BACKGROUND', (0, i), (-1, i), colors.lightgreen))
                else:
                    table_style.append(('BACKGROUND', (0, i), (-1, i), colors.white))
                
                # Resaltar stock bajo en rojo
                if stock_bajo:
                    try:
                        disponible = int(data[i][4])
                        if disponible < 10:
                            table_style.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#FEE2E2')))
                            table_style.append(('TEXTCOLOR', (4, i), (4, i), colors.HexColor('#DC2626')))
                            table_style.append(('FONTNAME', (4, i), (4, i), 'Helvetica-Bold'))
                    except:
                        pass
            
            # Estilo para fila de total
            table_style.append(('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#D1FAE5')))
            table_style.append(('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'))
            
            table.setStyle(TableStyle(table_style))
            
            story.append(table)
            
            # Leyenda de stock bajo
            if stock_bajo:
                story.append(Spacer(1, 0.2*inch))
                leyenda = Paragraph(
                    "<font color='#DC2626'><b>⚠ Artículos marcados en rojo tienen stock bajo (menos de 10 unidades)</b></font>",
                    ParagraphStyle('Leyenda', parent=styles['Normal'], fontSize=9, alignment=1)
                )
                story.append(leyenda)
                
        else:
            no_data = Paragraph(
                "<i>No se encontraron artículos en el inventario.</i>",
                ParagraphStyle('NoData', parent=styles['Normal'], alignment=1, textColor=colors.grey)
            )
            story.append(no_data)
        
        # Footer
        story.append(Spacer(1, 0.3*inch))
        footer = Paragraph(
            f"<i>Reporte generado el {fecha_actual}</i>",
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, 
                         alignment=1, textColor=colors.grey)
        )
        story.append(footer)
        
        # Generar PDF
        doc.build(story)
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f'reporte_inventario_{datetime.now().strftime("%Y%m%d")}.pdf',
            mimetype='application/pdf'
        )
        
    except Exception as e:
        print(f"Error generando reporte de inventario: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Error generando reporte de inventario: {str(e)}'
        }), 500

@app.route('/api/reportes/problemas/pdf', methods=['GET'])
def generar_reporte_problemas_pdf():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        # Obtener parámetros
        fecha_inicio = request.args.get('fecha_inicio', (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'))
        fecha_fin = request.args.get('fecha_fin', datetime.now().strftime('%Y-%m-%d'))
        tipo = request.args.get('tipo')
        responsable = request.args.get('responsable')
        graficos = request.args.get('graficos') == 'true'
        
        cursor = db.session.connection().connection.cursor()
        
        # Query para obtener problemas
        query = """
            SELECT rp.id_reporte, rp.tipo_problema, rp.descripcion_problema,
                   rp.costo_problema, rp.fecha_reporte, rp.responsable,
                   a.codigo as articulo_codigo, a.nombre_articulo,
                   e.numero_evento, c.nombre as cliente_nombre
            FROM reportes_problemas rp
            JOIN articulos a ON rp.id_articulo = a.id_articulo
            JOIN eventos e ON rp.id_evento = e.id_evento
            LEFT JOIN clientes c ON e.id_cliente = c.id_cliente
            WHERE DATE(rp.fecha_reporte) BETWEEN %s AND %s
        """
        
        params = [fecha_inicio, fecha_fin]
        
        if tipo:
            query += " AND rp.tipo_problema = %s"
            params.append(tipo)
            
        if responsable:
            query += " AND rp.responsable = %s"
            params.append(responsable)
        
        query += " ORDER BY rp.fecha_reporte DESC"
        
        cursor.execute(query, params)
        problemas = cursor.fetchall()
        
        # Crear PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=1*inch, bottomMargin=0.5*inch,
                               leftMargin=0.75*inch, rightMargin=0.75*inch)
        story = []
        
        # Estilos
        styles = getSampleStyleSheet()
        
        # Header con logo
        logo_path = 'static/alquifiestas.png'
        if os.path.exists(logo_path):
            logo = RLImage(logo_path, width=1.2*inch, height=1.2*inch)
            
            header_title = Paragraph(
                "<b>ALQUIFIESTAS LA CALZADA</b><br/>"
                "<font size=10>Teléfono: (502) 1234-5678 | Email: info@alquifiestas.com</font><br/>"
                "<font size=9>Ciudad de Guatemala</font>",
                ParagraphStyle('HeaderTitle', parent=styles['Normal'], fontSize=14, 
                             textColor=colors.HexColor('#2563EB'), alignment=2, spaceAfter=10)
            )
            
            header_data = [[logo, header_title]]
            header_table = Table(header_data, colWidths=[1.5*inch, 5*inch])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ]))
            story.append(header_table)
        else:
            company_name = Paragraph(
                "<b>ALQUIFIESTAS LA CALZADA</b>",
                ParagraphStyle('CompanyName', parent=styles['Heading1'], fontSize=20,
                             textColor=colors.HexColor('#2563EB'), alignment=1)
            )
            story.append(company_name)
        
        story.append(Spacer(1, 0.2*inch))
        
        # Línea separadora
        line_table = Table([['', '']], colWidths=[6.5*inch, 0*inch])
        line_table.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, 0), 2, colors.HexColor('#EF4444')),
        ]))
        story.append(line_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Título del reporte
        title = Paragraph(
            "<b>REPORTE DE PROBLEMAS</b>",
            ParagraphStyle('ReportTitle', parent=styles['Heading1'], fontSize=18,
                         textColor=colors.HexColor('#DC2626'), spaceAfter=20, alignment=1)
        )
        story.append(title)
        
        # Información del reporte
        fecha_actual = datetime.now().strftime("%d/%m/%Y %H:%M")
        
        info_data = [
            [Paragraph('<b>Período:</b>', styles['Normal']), 
             f"{fecha_inicio} al {fecha_fin}",
             Paragraph('<b>Generado:</b>', styles['Normal']), 
             fecha_actual],
            [Paragraph('<b>Total problemas:</b>', styles['Normal']), 
             str(len(problemas)),
             Paragraph('<b>Tipo:</b>', styles['Normal']), 
             tipo.upper() if tipo else 'TODOS'],
            [Paragraph('<b>Responsable:</b>', styles['Normal']),
             responsable if responsable else 'TODOS',
             '', '']
        ]
        
        info_table = Table(info_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 1.5*inch])
        info_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.3*inch))
        
        if problemas and len(problemas) > 0:
            # Estadísticas
            total_costo = sum(float(p[3]) if p[3] else 0 for p in problemas)
            problemas_rotos = sum(1 for p in problemas if p[1] == 'roto')
            problemas_perdidos = sum(1 for p in problemas if p[1] == 'perdido')
            
            # Costos por responsable
            costos_responsable = {}
            for p in problemas:
                resp = p[5] or 'Desconocido'
                costo = float(p[3]) if p[3] else 0
                costos_responsable[resp] = costos_responsable.get(resp, 0) + costo
            
            stats_data = [
                ['RESUMEN DE PROBLEMAS'],
                [f'Total de Problemas: {len(problemas)}'],
                [f'Problemas por Rotura: {problemas_rotos}'],
                [f'Problemas por Pérdida: {problemas_perdidos}'],
                [f'Costo Total: Q{total_costo:,.2f}'],
            ]
            
            stats_table = Table(stats_data, colWidths=[6.5*inch])
            stats_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EF4444')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 11),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#FEE2E2')),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#EF4444')),
            ]))
            story.append(stats_table)
            story.append(Spacer(1, 0.3*inch))
            
            # Tabla de costos por responsable
            if graficos and len(costos_responsable) > 0:
                story.append(Paragraph("<b>COSTOS POR RESPONSABLE</b>", styles['Heading3']))
                story.append(Spacer(1, 0.1*inch))
                
                resp_data = [['Responsable', 'Cantidad', 'Costo Total']]
                for resp, costo in sorted(costos_responsable.items(), key=lambda x: x[1], reverse=True):
                    cantidad = sum(1 for p in problemas if (p[5] or 'Desconocido') == resp)
                    resp_data.append([resp, str(cantidad), f"Q{costo:,.2f}"])
                
                resp_table = Table(resp_data, colWidths=[3*inch, 1.5*inch, 2*inch])
                resp_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#DC2626')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#FEE2E2')),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('FONTSIZE', (0, 1), (-1, -1), 9),
                ]))
                story.append(resp_table)
                story.append(Spacer(1, 0.3*inch))
            
            # Crear tabla detallada
            story.append(Paragraph("<b>DETALLE DE PROBLEMAS</b>", styles['Heading3']))
            story.append(Spacer(1, 0.1*inch))
            
            data = [['Fecha', 'Evento', 'Artículo', 'Tipo', 'Responsable', 'Costo']]
            
            for problema in problemas:
                fecha = problema[4].strftime('%d/%m/%Y') if problema[4] else ''
                
                data.append([
                    fecha,
                    problema[8] or '',
                    f"{problema[6]} - {problema[7]}"[:30],
                    problema[1].upper() if problema[1] else '',
                    problema[5] or 'Desconocido',
                    f"Q{float(problema[3]):,.2f}" if problema[3] else 'Q0.00'
                ])
            
            # Fila de total
            data.append(['', '', '', '', 
                        Paragraph('<b>TOTAL:</b>', styles['Normal']), 
                        Paragraph(f"<b>Q{total_costo:,.2f}</b>", styles['Normal'])])
            
            table = Table(data, colWidths=[0.9*inch, 1.2*inch, 2*inch, 0.8*inch, 1*inch, 1*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#DC2626')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#FEE2E2')]),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#FECACA')),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ]))
            
            story.append(table)
            
        else:
            no_data = Paragraph(
                "<i>No se encontraron problemas reportados en el período especificado con los filtros aplicados.</i>",
                ParagraphStyle('NoData', parent=styles['Normal'], alignment=1, textColor=colors.grey)
            )
            story.append(no_data)
        
        # Footer
        story.append(Spacer(1, 0.3*inch))
        footer = Paragraph(
            f"<i>Reporte generado el {fecha_actual}</i>",
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, 
                         alignment=1, textColor=colors.grey)
        )
        story.append(footer)
        
        # Generar PDF
        doc.build(story)
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f'reporte_problemas_{fecha_inicio}_al_{fecha_fin}.pdf',
            mimetype='application/pdf'
        )
        
    except Exception as e:
        print(f"Error generando reporte de problemas: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Error generando reporte de problemas: {str(e)}'
        }), 500


# ===============================================
# REPORTES DE PROBLEMAS
# ===============================================

@app.route('/api/eventos/<int:evento_id>/articulos-con-problemas', methods=['GET'])
def obtener_articulos_con_problemas(evento_id):
    """Obtener TODOS los artículos del evento que tienen estado 'con_problemas'"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        
        cursor.execute("""
            SELECT 
                ea.id_detalle,
                ea.id_articulo,
                a.codigo,
                a.nombre_articulo,
                ea.cantidad_solicitada,
                ea.precio_unitario as precio_alquiler,
                ea.estado_articulo
            FROM evento_articulos ea
            JOIN articulos a ON ea.id_articulo = a.id_articulo
            WHERE ea.id_evento = %s AND ea.estado_articulo = 'con_problemas'
            ORDER BY a.codigo
        """, (evento_id,))
        
        articulos = []
        for row in cursor.fetchall():
            articulos.append({
                'id_detalle': row[0],
                'id_articulo': row[1],
                'codigo': row[2],
                'nombre_articulo': row[3],
                'cantidad': row[4],
                'precio_unitario': float(row[5]),  # Usar precio de alquiler
                'estado': row[6]
            })
        
        return jsonify({
            'success': True,
            'articulos': articulos
        })
        
    except Exception as e:
        print(f"Error obteniendo artículos con problemas: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@app.route('/api/eventos/<int:evento_id>/reportar-problemas-multiples', methods=['POST'])
def reportar_problemas_multiples(evento_id):
    """Crear reportes para múltiples artículos con problemas"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.get_json()
        problemas = data.get('problemas', [])
        
        if not problemas:
            return jsonify({
                'success': False,
                'message': 'No se proporcionaron problemas para reportar'
            }), 400
        
        cursor = db.session.connection().connection.cursor()
        reportes_creados = []
        
        for problema in problemas:
            detalle_id = problema.get('id_detalle')
            tipo_problema = problema.get('tipo_problema')
            descripcion = problema.get('descripcion_problema')
            responsable = problema.get('responsable', 'Cliente')
            costo_problema = problema.get('costo_problema', 0)
            
            if not tipo_problema or not descripcion:
                continue  # Saltar si no tiene datos completos
            
            # Obtener información del artículo
            cursor.execute("""
                SELECT ea.id_articulo, a.nombre_articulo
                FROM evento_articulos ea
                JOIN articulos a ON ea.id_articulo = a.id_articulo
                WHERE ea.id_detalle = %s AND ea.id_evento = %s
            """, (detalle_id, evento_id))
            
            result = cursor.fetchone()
            if not result:
                continue
            
            id_articulo, nombre_articulo = result
            
            # Crear el reporte
            cursor.execute("""
                INSERT INTO reportes_problemas 
                (id_evento, id_articulo, tipo_problema, descripcion_problema, 
                 responsable, costo_problema, estado_reporte, reportado_por, fecha_reporte)
                VALUES (%s, %s, %s, %s, %s, %s, 'abierto', %s, 
                        CURRENT_TIMESTAMP AT TIME ZONE 'America/Guatemala')
                RETURNING id_reporte
            """, (
                evento_id,
                id_articulo,
                tipo_problema,
                descripcion,
                responsable,
                costo_problema,
                session.get('user_id')
            ))
            
            id_reporte = cursor.fetchone()[0]
            reportes_creados.append(id_reporte)
        
        db.session.commit()
        
        if not reportes_creados:
            return jsonify({
                'success': False,
                'message': 'No se pudo crear ningún reporte'
            }), 400
        
        return jsonify({
            'success': True,
            'message': f'{len(reportes_creados)} reporte(s) creado(s) exitosamente',
            'reportes_ids': reportes_creados,
            'evento_id': evento_id
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creando reportes múltiples: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Error al crear reportes: {str(e)}'
        }), 500


@app.route('/api/eventos/<int:evento_id>/reporte-problemas-consolidado/pdf', methods=['GET'])
def generar_reporte_problemas_consolidado_pdf(evento_id):
    """Generar PDF consolidado con TODOS los problemas del evento"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        
        # Obtener información del evento
        cursor.execute("""
            SELECT 
                e.numero_evento,
                e.fecha_evento,
                e.lugar_evento,
                c.nombre as cliente_nombre,
                c.telefono as cliente_telefono,
                c.direccion as cliente_direccion
            FROM eventos e
            LEFT JOIN clientes c ON e.id_cliente = c.id_cliente
            WHERE e.id_evento = %s
        """, (evento_id,))
        
        evento = cursor.fetchone()
        
        if not evento:
            return jsonify({
                'success': False,
                'message': 'Evento no encontrado'
            }), 404
        
        # Obtener todos los reportes de problemas del evento

        # Obtener todos los reportes de problemas del evento
        cursor.execute("""
            SELECT 
                rp.id_reporte,
                rp.tipo_problema,
                rp.descripcion_problema,
                rp.costo_problema,
                rp.fecha_reporte,
                rp.responsable,
                a.codigo as articulo_codigo,
                a.nombre_articulo,
                emp.nombre as empleado_nombre,
                ea.cantidad_solicitada,
                ea.precio_unitario as precio_alquiler
            FROM reportes_problemas rp
            JOIN articulos a ON rp.id_articulo = a.id_articulo
            LEFT JOIN users u ON rp.reportado_por = u.id
            LEFT JOIN empleados emp ON u.id = emp.user_id
            LEFT JOIN evento_articulos ea ON ea.id_evento = rp.id_evento AND ea.id_articulo = rp.id_articulo
            WHERE rp.id_evento = %s
            ORDER BY rp.fecha_reporte DESC
        """, (evento_id,))

        reportes = cursor.fetchall()

        
        if not reportes:
            return jsonify({
                'success': False,
                'message': 'No hay reportes de problemas para este evento'
            }), 404
        
        # Crear PDF
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
        from reportlab.lib.units import inch
        from io import BytesIO
        from datetime import datetime
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        elements = []
        styles = getSampleStyleSheet()
        
        # Estilos personalizados
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=26,
            textColor=colors.HexColor('#EF4444'),
            spaceAfter=10,
            alignment=1,
            fontName='Helvetica-Bold'
        )
        
        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Normal'],
            fontSize=12,
            textColor=colors.HexColor('#6B7280'),
            spaceAfter=30,
            alignment=1
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#1F2937'),
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        )
        
        # Título
        elements.append(Paragraph("REPORTE CONSOLIDADO DE PROBLEMAS", title_style))
        elements.append(Paragraph(f"Evento: {evento[0]}", subtitle_style))
        elements.append(Spacer(1, 0.2*inch))
        
        # Información del evento
        elements.append(Paragraph("INFORMACIÓN DEL EVENTO", heading_style))
        
        evento_data = [
            ['Número de Evento:', evento[0]],
            ['Cliente:', evento[3] or 'N/A'],
            ['Fecha del Evento:', evento[1].strftime('%d/%m/%Y') if evento[1] else 'N/A'],
            ['Lugar:', evento[2] or 'N/A'],
            ['Teléfono Cliente:', evento[4] or 'N/A'],
        ]
        
        evento_table = Table(evento_data, colWidths=[2*inch, 4*inch])
        evento_table.setStyle(TableStyle([
            ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 10),
            ('FONT', (1, 0), (1, -1), 'Helvetica', 10),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1F2937')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F9FAFB')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB')),
        ]))
        elements.append(evento_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Resumen de problemas
        total_costo = sum(float(r[3]) for r in reportes)
        
        elements.append(Paragraph("RESUMEN DE PROBLEMAS", heading_style))
        
        resumen_data = [
            ['Total de problemas reportados:', str(len(reportes))],
            ['Costo total de problemas:', f'Q{total_costo:.2f}'],
        ]
        
        resumen_table = Table(resumen_data, colWidths=[3*inch, 2*inch])
        resumen_table.setStyle(TableStyle([
            ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 11),
            ('FONT', (1, 0), (1, -1), 'Helvetica-Bold', 12),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#1F2937')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#EF4444')),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FEF2F2')),
            ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#EF4444')),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(resumen_table)
        elements.append(Spacer(1, 0.4*inch))
        
        # Detalle de cada problema
        elements.append(Paragraph("DETALLE DE PROBLEMAS", heading_style))
        elements.append(Spacer(1, 0.2*inch))
        
        tipo_problema_texto = {
            'daño': 'DAÑO',
            'perdida': 'PÉRDIDA',
            'faltante': 'FALTANTE',
            'defecto': 'DEFECTO',
            'roto': 'ROTO'
        }
        
        for i, reporte in enumerate(reportes, 1):
            # Encabezado del problema
            problema_header = ParagraphStyle(
                'ProblemaHeader',
                parent=styles['Normal'],
                fontSize=12,
                textColor=colors.white,
                fontName='Helvetica-Bold',
                spaceAfter=8
            )
            
            header_data = [[f"PROBLEMA #{i} - {reporte[6]}: {reporte[7]}"]]
            header_table = Table(header_data, colWidths=[6.5*inch])
            header_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EF4444')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
                ('FONT', (0, 0), (-1, -1), 'Helvetica-Bold', 11),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ]))
            elements.append(header_table)
            
            # Datos del problema
            problema_data = [
                ['Tipo de Problema:', tipo_problema_texto.get(reporte[1], reporte[1].upper())],
                ['Responsable:', reporte[5] or 'N/A'],
                ['Cantidad:', str(reporte[9] or 1)],  # cantidad_solicitada
                ['Precio Unitario:', f'Q{float(reporte[10] or 0):.2f}'],  # precio_alquiler
                ['Costo Total:', f'Q{float(reporte[3]):.2f}'],  # costo_problema
                ['Fecha del Reporte:', reporte[4].strftime('%d/%m/%Y %I:%M %p') if reporte[4] else 'N/A'],
                ['Reportado por:', reporte[8] or 'Sistema'],
            ]
                        
            problema_table = Table(problema_data, colWidths=[1.8*inch, 4.7*inch])
            problema_table.setStyle(TableStyle([
                ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 9),
                ('FONT', (1, 0), (1, -1), 'Helvetica', 9),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1F2937')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FAFAFA')),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
            ]))
            elements.append(problema_table)
            
            # Descripción
            desc_style = ParagraphStyle(
                'Descripcion',
                parent=styles['Normal'],
                fontSize=9,
                textColor=colors.HexColor('#374151'),
                spaceBefore=8,
                spaceAfter=8,
                leftIndent=10,
                rightIndent=10
            )
            
            desc_data = [[Paragraph(f"<b>Descripción:</b><br/>{reporte[2]}", desc_style)]]
            desc_table = Table(desc_data, colWidths=[6.5*inch])
            desc_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFFFFF')),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB')),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ]))
            elements.append(desc_table)
            elements.append(Spacer(1, 0.3*inch))
        
        # Total final
        elements.append(Spacer(1, 0.2*inch))
        total_data = [[f'COSTO TOTAL DE PROBLEMAS: Q{total_costo:.2f}']]
        total_table = Table(total_data, colWidths=[6.5*inch])
        total_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FEE2E2')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#991B1B')),
            ('FONT', (0, 0), (-1, -1), 'Helvetica-Bold', 14),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#EF4444')),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ]))
        elements.append(total_table)
        
        # Nota al pie
        elements.append(Spacer(1, 0.5*inch))
        nota_style = ParagraphStyle(
            'Nota',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#6B7280'),
            alignment=1
        )
        elements.append(Paragraph(
            "Este documento es un reporte oficial consolidado de todos los problemas presentados en el evento. "
            "Los costos indicados corresponden a los valores de reposición o reparación de los artículos afectados.",
            nota_style
        ))
        
        # Generar PDF
        doc.build(elements)
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'Reporte_Problemas_{evento[0]}.pdf'
        )
        
    except Exception as e:
        print(f"Error generando PDF consolidado: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Error al generar PDF: {str(e)}'
        }), 500

@app.route('/api/cotizaciones/<int:cotizacion_id>/pdf', methods=['GET'])
def generar_cotizacion_pdf(cotizacion_id):
    """Generar PDF de la cotización"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        
        # Obtener cotización completa usando nombres de columnas
        cursor.execute("""
            SELECT c.id_cotizacion, c.numero_cotizacion, c.id_cliente, c.id_empleado,
                   c.fecha_cotizacion, c.fecha_evento, c.hora_inicio, c.hora_fin,
                   c.lugar_evento, c.numero_invitados, c.monto_total, c.descuento,
                   c.estado, c.vigencia_dias, c.notas,
                   cl.nombre as cliente_nombre, cl.telefono as cliente_telefono,
                   cl.direccion as cliente_direccion, 
                   e.nombre as empleado_nombre
            FROM cotizaciones c
            LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
            LEFT JOIN empleados e ON c.id_empleado = e.id_empleado
            WHERE c.id_cotizacion = %s
        """, (cotizacion_id,))
        
        columns = [desc[0] for desc in cursor.description]
        result = cursor.fetchone()
        
        if not result:
            return jsonify({'success': False, 'message': 'Cotización no encontrada'}), 404
        
        # Convertir a diccionario para acceso por nombre
        cotizacion = dict(zip(columns, result))
        
        # Obtener artículos
        cursor.execute("""
            SELECT a.codigo, a.nombre_articulo, ca.cantidad, ca.precio_unitario, ca.subtotal
            FROM cotizacion_articulos ca
            JOIN articulos a ON ca.id_articulo = a.id_articulo
            WHERE ca.id_cotizacion = %s
        """, (cotizacion_id,))
        articulos = cursor.fetchall()
        
        # Obtener servicios
        cursor.execute("""
            SELECT s.codigo, s.nombre_servicio, cs.cantidad_horas, cs.precio_unitario, cs.subtotal
            FROM cotizacion_servicios cs
            JOIN servicios s ON cs.id_servicio = s.id_servicio
            WHERE cs.id_cotizacion = %s
        """, (cotizacion_id,))
        servicios = cursor.fetchall()
        
        # Crear PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=1*inch, bottomMargin=0.5*inch,
                               leftMargin=0.75*inch, rightMargin=0.75*inch)
        story = []
        
        # Estilos
        styles = getSampleStyleSheet()
        
        # Header con logo
        logo_path = 'static/alquifiestas.png'
        if os.path.exists(logo_path):
            logo = RLImage(logo_path, width=1.2*inch, height=1.2*inch)
            
            header_title = Paragraph(
                "<b>ALQUIFIESTAS LA CALZADA</b><br/>"
                "<font size=10>Teléfono: (502) 1234-5678 | Email: info@alquifiestas.com</font><br/>"
                "<font size=9>Ciudad de Guatemala</font>",
                ParagraphStyle('HeaderTitle', parent=styles['Normal'], fontSize=14, 
                             textColor=colors.HexColor('#2563EB'), alignment=2, spaceAfter=10)
            )
            
            header_data = [[logo, header_title]]
            header_table = Table(header_data, colWidths=[1.5*inch, 5*inch])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ]))
            story.append(header_table)
        else:
            # Fallback si no existe el logo
            company_name = Paragraph(
                "<b>ALQUIFIESTAS LA CALZADA</b>",
                ParagraphStyle('CompanyName', parent=styles['Heading1'], fontSize=20,
                             textColor=colors.HexColor('#2563EB'), alignment=1)
            )
            story.append(company_name)
        
        story.append(Spacer(1, 0.2*inch))
        
        # Línea separadora
        line_table = Table([['', '']], colWidths=[6.5*inch, 0*inch])
        line_table.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, 0), 2, colors.HexColor('#2563EB')),
        ]))
        story.append(line_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Título de cotización
        title = Paragraph(
            f"<b>COTIZACIÓN {cotizacion['numero_cotizacion']}</b>",
            ParagraphStyle('CotTitle', parent=styles['Heading1'], fontSize=18,
                         textColor=colors.HexColor('#1D4ED8'), spaceAfter=20, alignment=1)
        )
        story.append(title)
        
        # Función helper para formatear fechas de forma segura
        def format_fecha(fecha):
            if fecha is None:
                return 'N/A'
            if isinstance(fecha, date):
                return fecha.strftime('%d/%m/%Y')
            if isinstance(fecha, str):
                try:
                    return datetime.strptime(fecha, '%Y-%m-%d').strftime('%d/%m/%Y')
                except:
                    return fecha
            return 'N/A'
        
        def format_hora(hora):
            if hora is None:
                return 'N/A'
            if isinstance(hora, time):
                return hora.strftime('%H:%M')
            if isinstance(hora, str):
                return hora
            return 'N/A'
        
        # Información general
        fecha_actual = datetime.now().strftime("%d/%m/%Y")
        
        info_data = [
            [Paragraph('<b>Fecha de Cotización:</b>', styles['Normal']), 
             format_fecha(cotizacion['fecha_cotizacion']),
             Paragraph('<b>Vigencia:</b>', styles['Normal']), 
             f"{cotizacion['vigencia_dias']} días"],
            
            [Paragraph('<b>Cliente:</b>', styles['Normal']), 
             cotizacion['cliente_nombre'] or 'Por definir',
             Paragraph('<b>Teléfono:</b>', styles['Normal']), 
             cotizacion['cliente_telefono'] or 'N/A'],
            
            [Paragraph('<b>Fecha del Evento:</b>', styles['Normal']), 
             format_fecha(cotizacion['fecha_evento']),
             Paragraph('<b>Hora:</b>', styles['Normal']), 
             f"{format_hora(cotizacion['hora_inicio'])} - {format_hora(cotizacion['hora_fin'])}"],
            
            [Paragraph('<b>Lugar:</b>', styles['Normal']), 
             cotizacion['lugar_evento'] or 'Por definir',
             Paragraph('<b>Invitados:</b>', styles['Normal']), 
             str(cotizacion['numero_invitados']) if cotizacion['numero_invitados'] else 'Por definir']
        ]
        
        info_table = Table(info_data, colWidths=[1.5*inch, 2.5*inch, 1.2*inch, 1.3*inch])
        info_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Artículos
        if articulos and len(articulos) > 0:
            story.append(Paragraph("<b>ARTÍCULOS</b>", styles['Heading3']))
            story.append(Spacer(1, 0.1*inch))
            
            articulos_data = [['Código', 'Artículo', 'Cantidad', 'Precio Unit.', 'Subtotal']]
            for art in articulos:
                articulos_data.append([
                    art[0] or '',
                    art[1],
                    str(art[2]),
                    f"Q{float(art[3]):.2f}",
                    f"Q{float(art[4]):.2f}"
                ])
            
            articulos_table = Table(articulos_data, colWidths=[0.9*inch, 2.8*inch, 0.9*inch, 1*inch, 1*inch])
            articulos_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
            ]))
            story.append(articulos_table)
            story.append(Spacer(1, 0.2*inch))
        
        # Servicios
        if servicios and len(servicios) > 0:
            story.append(Paragraph("<b>SERVICIOS</b>", styles['Heading3']))
            story.append(Spacer(1, 0.1*inch))
            
            servicios_data = [['Código', 'Servicio', 'Horas', 'Precio Unit.', 'Subtotal']]
            for serv in servicios:
                servicios_data.append([
                    serv[0] or '',
                    serv[1],
                    str(serv[2]),
                    f"Q{float(serv[3]):.2f}",
                    f"Q{float(serv[4]):.2f}"
                ])
            
            servicios_table = Table(servicios_data, colWidths=[0.9*inch, 2.8*inch, 0.9*inch, 1*inch, 1*inch])
            servicios_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10B981')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                ('BACKGROUND', (0, 1), (-1, -1), colors.lightgreen),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
            ]))
            story.append(servicios_table)
            story.append(Spacer(1, 0.2*inch))
        
        # Mensaje si no hay artículos ni servicios
        if (not articulos or len(articulos) == 0) and (not servicios or len(servicios) == 0):
            no_items = Paragraph(
                "<i>No se han agregado artículos ni servicios a esta cotización.</i>",
                ParagraphStyle('NoData', parent=styles['Normal'], alignment=1, textColor=colors.grey)
            )
            story.append(no_items)
            story.append(Spacer(1, 0.2*inch))
        
        # Totales
        monto_total = float(cotizacion['monto_total']) if cotizacion['monto_total'] else 0
        descuento = float(cotizacion['descuento']) if cotizacion['descuento'] else 0
        total_final = monto_total - descuento

        totales_data = [
            ['Subtotal:', f"Q{monto_total:.2f}"],
            ['Descuento:', f"Q{descuento:.2f}"],
            [Paragraph('<b>TOTAL:</b>', styles['Normal']), 
             Paragraph(f"<b>Q{total_final:.2f}</b>", styles['Normal'])]
        ]

        totales_table = Table(totales_data, colWidths=[5*inch, 1.5*inch])
        totales_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('FONTSIZE', (0, -1), (-1, -1), 14),
            ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#2563EB')),
            ('LINEABOVE', (0, -1), (-1, -1), 2, colors.HexColor('#2563EB')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(totales_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Notas
        if cotizacion['notas']:
            story.append(Paragraph("<b>NOTAS:</b>", styles['Heading4']))
            story.append(Paragraph(cotizacion['notas'], styles['Normal']))
            story.append(Spacer(1, 0.2*inch))
        
        # Términos y condiciones
        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph("<b>TÉRMINOS Y CONDICIONES</b>", styles['Heading4']))
        terminos = [
            f"• Esta cotización tiene una validez de {cotizacion['vigencia_dias']} días a partir de la fecha de emisión.",
            "• Los precios están sujetos a cambios sin previo aviso.",
            "• Se requiere un anticipo del 50% para confirmar la reserva.",
            "• El saldo restante debe ser pagado antes o el día del evento.",
            "• Las cancelaciones deben notificarse con al menos 7 días de anticipación.",
            "• Los artículos deben ser devueltos en las mismas condiciones en que fueron entregados."
        ]
        for termino in terminos:
            story.append(Paragraph(termino, ParagraphStyle('Terminos', parent=styles['Normal'], fontSize=8, leftIndent=20)))
        
        # Footer
        story.append(Spacer(1, 0.3*inch))
        footer = Paragraph(
            f"<i>Cotización generada el {fecha_actual}</i><br/>"
            f"<i>Atendido por: {cotizacion['empleado_nombre'] or 'N/A'}</i><br/><br/>"
            "¡Gracias por su preferencia!",
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, 
                         alignment=1, textColor=colors.grey)
        )
        story.append(footer)
        
        # Generar PDF
        doc.build(story)
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"cotizacion_{cotizacion['numero_cotizacion']}.pdf",
            mimetype='application/pdf'
        )
        
    except Exception as e:
        print(f"Error generando PDF de cotización: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Error generando PDF: {str(e)}'
        }), 500
    
# ===============================================
# ENDPOINTS ADICIONALES
# ===============================================

@app.route('/api/categorias', methods=['GET'])
def get_categorias():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        cursor.execute("SELECT id_categoria, nombre, descripcion FROM categorias_articulos ORDER BY nombre")
        
        columns = [desc[0] for desc in cursor.description]
        results = cursor.fetchall()
        
        categorias = [dict(zip(columns, row)) for row in results]
        
        return jsonify({
            'success': True,
            'categorias': categorias
        })
        
    except Exception as e:
        print(f"Error obteniendo categorías: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo categorías'
        }), 500

@app.route('/api/servicios', methods=['GET'])
def get_servicios():
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        cursor.execute("""
            SELECT id_servicio, codigo, nombre_servicio, categoria, descripcion,
                   precio_por_hora, precio_fijo, tipo_precio, horas_minimas, estado
            FROM servicios 
            WHERE estado = 'activo'
            ORDER BY categoria, nombre_servicio
        """)
        
        columns = [desc[0] for desc in cursor.description]
        results = cursor.fetchall()
        
        servicios = []
        for row in results:
            servicio = dict(zip(columns, row))
            if servicio['precio_por_hora']:
                servicio['precio_por_hora'] = float(servicio['precio_por_hora'])
            if servicio['precio_fijo']:
                servicio['precio_fijo'] = float(servicio['precio_fijo'])
            servicios.append(servicio)
        
        return jsonify({
            'success': True,
            'servicios': servicios
        })
        
    except Exception as e:
        print(f"Error obteniendo servicios: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo servicios'
        }), 500
    
# ===============================================
# ENDPOINT CORREGIDO PARA EVENTOS COMPLETOS
# ===============================================

@app.route('/api/eventos/completo', methods=['POST'])
def create_evento_completo():
    """Crear evento completo con artículos y servicios SIN descontar stock"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.get_json()
        
        # Validaciones
        required_fields = ['id_cliente', 'fecha_evento']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'success': False,
                    'message': f'El campo {field} es requerido'
                }), 400
        
        cursor = db.session.connection().connection.cursor()
        empleado_id = get_empleado_id()
        
        # Generar número de evento único
        cursor.execute("SELECT COUNT(*) FROM eventos WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)")
        count = cursor.fetchone()[0] + 1
        numero_evento = f"EVT-{datetime.now().year}-{count:04d}"
        
        # Insertar evento
        cursor.execute("""
            INSERT INTO eventos (numero_evento, id_cliente, id_empleado_asignado, fecha_evento,
                               hora_inicio, hora_fin, lugar_evento, numero_invitados, notas, 
                               estado, monto_total)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'reservado', %s)
            RETURNING id_evento
        """, (
            numero_evento,
            data['id_cliente'],
            empleado_id,
            data['fecha_evento'],
            data.get('hora_inicio'),
            data.get('hora_fin'),
            data.get('lugar_evento', ''),
            data.get('numero_invitados'),
            data.get('notas', ''),
            data.get('monto_total', 0)
        ))
        
        evento_id = cursor.fetchone()[0]
        
        # Insertar artículos del evento (SOLO registrar, NO descontar stock)
        articulos = data.get('articulos', [])
        for articulo in articulos:
            # Verificar que el artículo existe
            cursor.execute("""
                SELECT cantidad_disponible, nombre_articulo 
                FROM articulos 
                WHERE id_articulo = %s
            """, (articulo['id_articulo'],))
            
            stock_info = cursor.fetchone()
            if not stock_info:
                db.session.rollback()
                return jsonify({
                    'success': False,
                    'message': f'Artículo con ID {articulo["id_articulo"]} no encontrado'
                }), 400
            
            # IMPORTANTE: Solo registrar en evento_articulos con estado 'reservado'
            # NO descontar del stock todavía
            cursor.execute("""
                INSERT INTO evento_articulos (id_evento, id_articulo, cantidad_solicitada, 
                                            precio_unitario, estado_articulo, notas)
                VALUES (%s, %s, %s, %s, 'reservado', %s)
            """, (
                evento_id,
                articulo['id_articulo'],
                articulo['cantidad'],
                articulo['precio_unitario'],
                f'Reservado para evento {numero_evento}'
            ))
        
        # Insertar servicios del evento
        servicios = data.get('servicios', [])
        for servicio in servicios:
            cursor.execute("""
                SELECT nombre_servicio FROM servicios 
                WHERE id_servicio = %s AND estado = 'activo'
            """, (servicio['id_servicio'],))
            
            servicio_info = cursor.fetchone()
            if not servicio_info:
                db.session.rollback()
                return jsonify({
                    'success': False,
                    'message': f'Servicio con ID {servicio["id_servicio"]} no encontrado o inactivo'
                }), 400
            
            cursor.execute("""
                INSERT INTO evento_servicios (id_evento, id_servicio, horas_contratadas, precio_unitario, notas)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                evento_id,
                servicio['id_servicio'],
                servicio.get('cantidad', 1),
                servicio['precio_unitario'],
                f'Agregado desde evento completo'
            ))
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Evento creado exitosamente',
            'evento_id': evento_id,
            'numero_evento': numero_evento
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creando evento completo: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error creando evento completo: {str(e)}'
        }), 500
    
# ===============================================
# ENDPOINTS ADICIONALES CORREGIDOS
# ===============================================

@app.route('/api/eventos/<int:evento_id>/articulos', methods=['POST'])
def add_articulo_to_evento(evento_id):
    """Agregar artículo a un evento existente"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.get_json()
        
        required_fields = ['id_articulo', 'cantidad', 'precio_unitario']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'El campo {field} es requerido'
                }), 400
        
        cursor = db.session.connection().connection.cursor()
        
        # Verificar stock disponible
        cursor.execute("""
            SELECT cantidad_disponible, nombre_articulo FROM articulos 
            WHERE id_articulo = %s AND estado = 'activo'
        """, (data['id_articulo'],))
        
        result = cursor.fetchone()
        if not result:
            return jsonify({
                'success': False,
                'message': 'Artículo no encontrado'
            }), 404
        
        if result[0] < data['cantidad']:
            return jsonify({
                'success': False,
                'message': f'No hay suficiente stock disponible. Disponible: {result[0]}'
            }), 400
        
        # Verificar si ya existe el artículo en el evento
        cursor.execute("""
            SELECT cantidad_solicitada FROM evento_articulos 
            WHERE id_evento = %s AND id_articulo = %s
        """, (evento_id, data['id_articulo']))
        
        existing = cursor.fetchone()
        
        if existing:
            # Actualizar cantidad existente
            nueva_cantidad = existing[0] + data['cantidad']
            cursor.execute("""
                UPDATE evento_articulos 
                SET cantidad_solicitada = %s
                WHERE id_evento = %s AND id_articulo = %s
            """, (nueva_cantidad, evento_id, data['id_articulo']))
        else:
            # Agregar nuevo artículo al evento
            cursor.execute("""
                INSERT INTO evento_articulos (id_evento, id_articulo, cantidad_solicitada, precio_unitario)
                VALUES (%s, %s, %s, %s)
            """, (
                evento_id,
                data['id_articulo'],
                data['cantidad'],
                data['precio_unitario']
            ))
        
        # Actualizar stock
        cursor.execute("""
            UPDATE articulos 
            SET cantidad_disponible = cantidad_disponible - %s
            WHERE id_articulo = %s
        """, (data['cantidad'], data['id_articulo']))
        
        # Registrar movimiento
        cursor.execute("""
            INSERT INTO movimientos_inventario (id_articulo, id_evento, tipo_movimiento, cantidad,
                                              cantidad_anterior, cantidad_nueva, responsable, observaciones)
            VALUES (%s, %s, 'salida', %s, %s, %s, %s, %s)
        """, (
            data['id_articulo'],
            evento_id,
            data['cantidad'],
            result[0],
            result[0] - data['cantidad'],
            session.get('user_name', 'Sistema'),
            f'Artículo agregado al evento'
        ))
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Artículo agregado al evento exitosamente'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error agregando artículo a evento: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error agregando artículo al evento'
        }), 500

@app.route('/api/eventos/<int:evento_id>/servicios', methods=['POST'])
def add_servicio_to_evento(evento_id):
    """Agregar servicio a un evento existente"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.get_json()
        
        required_fields = ['id_servicio', 'horas', 'precio_unitario']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'El campo {field} es requerido'
                }), 400
        
        cursor = db.session.connection().connection.cursor()
        
        # Verificar que el servicio existe
        cursor.execute("""
            SELECT nombre_servicio FROM servicios 
            WHERE id_servicio = %s AND estado = 'activo'
        """, (data['id_servicio'],))
        
        if not cursor.fetchone():
            return jsonify({
                'success': False,
                'message': 'Servicio no encontrado'
            }), 404
        
        # Verificar si ya existe el servicio en el evento
        cursor.execute("""
            SELECT horas_contratadas FROM evento_servicios 
            WHERE id_evento = %s AND id_servicio = %s
        """, (evento_id, data['id_servicio']))
        
        existing = cursor.fetchone()
        
        if existing:
            # Actualizar horas existentes
            nuevas_horas = existing[0] + data['horas']
            cursor.execute("""
                UPDATE evento_servicios 
                SET horas_contratadas = %s
                WHERE id_evento = %s AND id_servicio = %s
            """, (nuevas_horas, evento_id, data['id_servicio']))
        else:
            # Agregar nuevo servicio al evento
            cursor.execute("""
                INSERT INTO evento_servicios (id_evento, id_servicio, horas_contratadas, precio_unitario)
                VALUES (%s, %s, %s, %s)
            """, (
                evento_id,
                data['id_servicio'],
                data['horas'],
                data['precio_unitario']
            ))
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Servicio agregado al evento exitosamente'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error agregando servicio a evento: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error agregando servicio al evento'
        }), 500

# ===============================================
# ENDPOINT PARA OBTENER DETALLES COMPLETOS DEL EVENTO
# ===============================================

@app.route('/api/eventos/<int:evento_id>/completo', methods=['GET'])
def get_evento_completo(evento_id):
    """Obtener evento con todos sus detalles (artículos y servicios)"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        
        # Obtener evento básico
        cursor.execute("""
            SELECT e.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono,
                   emp.nombre as empleado_nombre
            FROM eventos e
            LEFT JOIN clientes c ON e.id_cliente = c.id_cliente
            LEFT JOIN empleados emp ON e.id_empleado_asignado = emp.id_empleado
            WHERE e.id_evento = %s
        """, (evento_id,))
        
        columns = [desc[0] for desc in cursor.description]
        result = cursor.fetchone()
        
        if not result:
            return jsonify({
                'success': False,
                'message': 'Evento no encontrado'
            }), 404
        
        evento = dict(zip(columns, result))
        
        # Convertir tipos para JSON
        if evento['monto_total']:
            evento['monto_total'] = float(evento['monto_total'])
        if evento['monto_pagado']:
            evento['monto_pagado'] = float(evento['monto_pagado'])
        if evento['saldo_pendiente']:
            evento['saldo_pendiente'] = float(evento['saldo_pendiente'])
        if evento['fecha_evento']:
            evento['fecha_evento'] = evento['fecha_evento'].isoformat()
        if evento['hora_inicio']:
            evento['hora_inicio'] = str(evento['hora_inicio'])
        if evento['hora_fin']:
            evento['hora_fin'] = str(evento['hora_fin'])
        if evento['created_at']:
            evento['created_at'] = evento['created_at'].isoformat()
        if evento['updated_at']:
            evento['updated_at'] = evento['updated_at'].isoformat()
        
        # Obtener artículos del evento
        cursor.execute("""
            SELECT ea.*, a.nombre_articulo, a.codigo, a.precio_unitario as precio_base
            FROM evento_articulos ea
            JOIN articulos a ON ea.id_articulo = a.id_articulo
            WHERE ea.id_evento = %s
        """, (evento_id,))
        
        articulos_columns = [desc[0] for desc in cursor.description]
        articulos_results = cursor.fetchall()
        
        articulos = []
        for row in articulos_results:
            articulo = dict(zip(articulos_columns, row))
            if articulo['precio_unitario']:
                articulo['precio_unitario'] = float(articulo['precio_unitario'])
            if articulo['precio_base']:
                articulo['precio_base'] = float(articulo['precio_base'])
            if articulo['subtotal']:
                articulo['subtotal'] = float(articulo['subtotal'])
            articulos.append(articulo)
        
        # Obtener servicios del evento
        cursor.execute("""
            SELECT es.*, s.nombre_servicio, s.categoria, s.precio_por_hora, s.precio_fijo
            FROM evento_servicios es
            JOIN servicios s ON es.id_servicio = s.id_servicio
            WHERE es.id_evento = %s
        """, (evento_id,))
        
        servicios_columns = [desc[0] for desc in cursor.description]
        servicios_results = cursor.fetchall()
        
        servicios = []
        for row in servicios_results:
            servicio = dict(zip(servicios_columns, row))
            if servicio['precio_unitario']:
                servicio['precio_unitario'] = float(servicio['precio_unitario'])
            if servicio['precio_por_hora']:
                servicio['precio_por_hora'] = float(servicio['precio_por_hora'])
            if servicio['precio_fijo']:
                servicio['precio_fijo'] = float(servicio['precio_fijo'])
            if servicio['subtotal']:
                servicio['subtotal'] = float(servicio['subtotal'])
            servicios.append(servicio)
        
        # Obtener pagos
        cursor.execute("""
            SELECT p.*, u.full_name as registrado_por_nombre
            FROM pagos p
            LEFT JOIN users u ON p.registrado_por = u.id
            WHERE p.id_evento = %s
            ORDER BY p.fecha_pago DESC
        """, (evento_id,))
        
        pagos_columns = [desc[0] for desc in cursor.description]
        pagos_results = cursor.fetchall()
        
        pagos = []
        for row in pagos_results:
            pago = dict(zip(pagos_columns, row))
            if pago['monto']:
                pago['monto'] = float(pago['monto'])
            if pago['fecha_pago']:
                pago['fecha_pago'] = pago['fecha_pago'].isoformat()
            pagos.append(pago)
        
        evento['articulos'] = articulos
        evento['servicios'] = servicios
        evento['pagos'] = pagos
        
        return jsonify({
            'success': True,
            'evento': evento
        })
        
    except Exception as e:
        print(f"Error obteniendo evento completo: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo evento completo'
        }), 500


# ===============================================
# ENDPOINTS PARA GESTIÓN DE ARTÍCULOS POR EVENTO
# ===============================================
@app.route('/api/eventos/<int:evento_id>/articulos', methods=['GET'])
def get_evento_articulos(evento_id):
    """Obtener artículos de un evento con su estado"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        
        print(f"🔍 Buscando evento con ID: {evento_id}")  # Log para debugging
        
        # Obtener información del evento
        cursor.execute("""
            SELECT e.numero_evento, e.fecha_evento, e.estado, c.nombre as cliente_nombre
            FROM eventos e
            LEFT JOIN clientes c ON e.id_cliente = c.id_cliente
            WHERE e.id_evento = %s
        """, (evento_id,))
        
        evento_info = cursor.fetchone()
        
        if not evento_info:
            print(f"❌ Evento {evento_id} no encontrado")
            return jsonify({
                'success': False,
                'message': f'Evento con ID {evento_id} no encontrado'
            }), 404
        
        print(f"✅ Evento encontrado: {evento_info[0]}")
        
        # Obtener artículos del evento
        cursor.execute("""
            SELECT ea.id_detalle, ea.id_articulo, a.codigo, a.nombre_articulo,
                   ea.cantidad_solicitada, ea.cantidad_entregada, ea.cantidad_recogida,
                   ea.cantidad_dañada, ea.cantidad_perdida, ea.precio_unitario,
                   ea.estado_articulo, 
                   ea.fecha_recogida, ea.fecha_entrega, ea.fecha_devolucion,
                   ea.notas, a.cantidad_disponible as stock_actual
            FROM evento_articulos ea
            JOIN articulos a ON ea.id_articulo = a.id_articulo
            WHERE ea.id_evento = %s
            ORDER BY a.nombre_articulo
        """, (evento_id,))
        
        columns = [desc[0] for desc in cursor.description]
        articulos_results = cursor.fetchall()
        
        print(f"✅ {len(articulos_results)} artículos encontrados")
        
        articulos = []
        for row in articulos_results:
            articulo = dict(zip(columns, row))
            # Convertir tipos para JSON
            if articulo['precio_unitario']:
                articulo['precio_unitario'] = float(articulo['precio_unitario'])
            # Convertir fechas a ISO format
            if articulo.get('fecha_recogida'):
                articulo['fecha_recogida'] = articulo['fecha_recogida'].isoformat() if articulo['fecha_recogida'] else None
            if articulo.get('fecha_entrega'):
                articulo['fecha_entrega'] = articulo['fecha_entrega'].isoformat() if articulo['fecha_entrega'] else None
            if articulo.get('fecha_devolucion'):
                articulo['fecha_devolucion'] = articulo['fecha_devolucion'].isoformat() if articulo['fecha_devolucion'] else None
            articulos.append(articulo)
        
        response_data = {
            'success': True,
            'evento': {
                'id_evento': evento_id,
                'numero_evento': evento_info[0],
                'fecha_evento': evento_info[1].isoformat() if evento_info[1] else None,
                'estado': evento_info[2],
                'cliente_nombre': evento_info[3]
            },
            'articulos': articulos
        }
        
        print(f"📤 Enviando respuesta exitosa")
        return jsonify(response_data)
        
    except Exception as e:
        print(f"❌ Error en get_evento_articulos: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Error obteniendo artículos del evento: {str(e)}'
        }), 500


@app.route('/api/eventos/<int:evento_id>/articulos/<int:detalle_id>/estado', methods=['PUT'])
def update_articulo_estado(evento_id, detalle_id):
    """Actualizar estado de un artículo en un evento - SIMPLIFICADO A 4 ESTADOS"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.get_json()
        nuevo_estado = data.get('estado_articulo')
        
        if not nuevo_estado:
            return jsonify({
                'success': False,
                'message': 'El estado es requerido'
            }), 400
        
        # Validar estado - SOLO 4 ESTADOS
        estados_validos = ['reservado', 'entregado', 'recogido', 'con_problemas']
        if nuevo_estado not in estados_validos:
            return jsonify({
                'success': False,
                'message': f'Estado inválido. Estados válidos: {", ".join(estados_validos)}'
            }), 400
        
        cursor = db.session.connection().connection.cursor()
        
        # Obtener información del artículo
        cursor.execute("""
            SELECT ea.id_articulo, ea.cantidad_solicitada, ea.estado_articulo, 
                   a.cantidad_disponible, a.nombre_articulo
            FROM evento_articulos ea
            JOIN articulos a ON ea.id_articulo = a.id_articulo
            WHERE ea.id_detalle = %s AND ea.id_evento = %s
        """, (detalle_id, evento_id))
        
        result = cursor.fetchone()
        if not result:
            return jsonify({
                'success': False,
                'message': 'Artículo no encontrado en este evento'
            }), 404
        
        id_articulo, cantidad_solicitada, estado_actual, stock_disponible, nombre_articulo = result
        
        # Lógica de actualización de stock según el cambio de estado
        campo_fecha = None
        actualizar_stock = False
        cambio_stock = 0
        registrar_movimiento = False
        tipo_movimiento = None
        
        # LÓGICA SIMPLIFICADA:
        # reservado -> entregado: se descuenta del stock
        # entregado -> recogido: se devuelve al stock
        
        if estado_actual == 'reservado' and nuevo_estado == 'entregado':
            # Al entregar, se reduce el stock
            campo_fecha = 'fecha_entrega'
            actualizar_stock = True
            cambio_stock = -cantidad_solicitada
            registrar_movimiento = True
            tipo_movimiento = 'salida'
            
            # Actualizar cantidad_entregada
            cursor.execute("""
                UPDATE evento_articulos 
                SET cantidad_entregada = cantidad_solicitada
                WHERE id_detalle = %s
            """, (detalle_id,))
            
        elif estado_actual == 'entregado' and nuevo_estado == 'recogido':
            # Al recoger, se aumenta el stock
            campo_fecha = 'fecha_devolucion'
            actualizar_stock = True
            cambio_stock = cantidad_solicitada
            registrar_movimiento = True
            tipo_movimiento = 'recogida'
            
            # Actualizar cantidad_recogida
            cursor.execute("""
                UPDATE evento_articulos 
                SET cantidad_recogida = cantidad_solicitada
                WHERE id_detalle = %s
            """, (detalle_id,))
        
        # Verificar si hay stock suficiente al entregar
        if cambio_stock < 0 and (stock_disponible + cambio_stock) < 0:
            return jsonify({
                'success': False,
                'message': f'No hay suficiente stock disponible de {nombre_articulo}. Disponible: {stock_disponible}'
            }), 400
        
        # Actualizar estado del artículo en el evento
        update_query = """
            UPDATE evento_articulos 
            SET estado_articulo = %s
        """
        params = [nuevo_estado]
        
        if campo_fecha:
            update_query += f", {campo_fecha} = CURRENT_TIMESTAMP"
        
        update_query += " WHERE id_detalle = %s"
        params.append(detalle_id)
        
        cursor.execute(update_query, params)
        
        # Actualizar stock si es necesario
        if actualizar_stock and cambio_stock != 0:
            cursor.execute("""
                UPDATE articulos 
                SET cantidad_disponible = cantidad_disponible + %s
                WHERE id_articulo = %s
            """, (cambio_stock, id_articulo))
        
        # Registrar movimiento de inventario
        if registrar_movimiento:
            cursor.execute("""
                INSERT INTO movimientos_inventario 
                (id_articulo, id_evento, tipo_movimiento, cantidad, 
                 cantidad_anterior, cantidad_nueva, responsable, observaciones)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                id_articulo,
                evento_id,
                tipo_movimiento,
                abs(cambio_stock),
                stock_disponible,
                stock_disponible + cambio_stock,
                session.get('user_name', 'Sistema'),
                f'Cambio de estado de {estado_actual} a {nuevo_estado}'
            ))
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Estado actualizado a {nuevo_estado}',
            'nuevo_estado': nuevo_estado
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error actualizando estado del artículo: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Error actualizando estado: {str(e)}'
        }), 500

@app.route('/api/eventos/articulos/gestion', methods=['GET'])
def get_eventos_con_articulos():
    """Obtener todos los eventos con artículos para gestión"""
    auth_check = require_login()
    if auth_check:
        return auth_check
    
    try:
        cursor = db.session.connection().connection.cursor()
        empleado_id = get_empleado_id()
        
        # Obtener eventos con artículos (solo eventos futuros o en curso)
        query = """
            SELECT DISTINCT e.id_evento, e.numero_evento, e.fecha_evento, e.estado,
                   c.nombre as cliente_nombre,
                   COUNT(ea.id_detalle) as total_articulos,
                   SUM(CASE WHEN ea.estado_articulo = 'reservado' THEN 1 ELSE 0 END) as articulos_reservados,
                   SUM(CASE WHEN ea.estado_articulo = 'recogido' THEN 1 ELSE 0 END) as articulos_recogidos,
                   SUM(CASE WHEN ea.estado_articulo = 'entregado' THEN 1 ELSE 0 END) as articulos_entregados,
                   SUM(CASE WHEN ea.estado_articulo = 'devuelto' THEN 1 ELSE 0 END) as articulos_devueltos
            FROM eventos e
            LEFT JOIN clientes c ON e.id_cliente = c.id_cliente
            LEFT JOIN evento_articulos ea ON e.id_evento = ea.id_evento
            WHERE e.estado NOT IN ('cancelado', 'completado')
            AND (e.id_empleado_asignado = %s OR e.id_empleado_asignado IS NULL OR %s IS NULL)
            GROUP BY e.id_evento, e.numero_evento, e.fecha_evento, e.estado, c.nombre
            HAVING COUNT(ea.id_detalle) > 0
            ORDER BY e.fecha_evento ASC
        """
        
        cursor.execute(query, (empleado_id, empleado_id))
        columns = [desc[0] for desc in cursor.description]
        results = cursor.fetchall()
        
        eventos = []
        for row in results:
            evento = dict(zip(columns, row))
            if evento['fecha_evento']:
                evento['fecha_evento'] = evento['fecha_evento'].isoformat()
            eventos.append(evento)
        
        return jsonify({
            'success': True,
            'eventos': eventos
        })
        
    except Exception as e:
        print(f"Error obteniendo eventos con artículos: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error obteniendo eventos con artículos'
        }), 500

# ===============================================
# MANEJO DE ERRORES
# ===============================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': 'Endpoint no encontrado'}), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'success': False, 'message': 'Error interno del servidor'}), 500


# ===============================================
# ENDPOINTS PARA EVENTOS
# ===============================================

@app.route('/api/eventos/<int:evento_id>/puede-eliminar', methods=['GET'])
def puede_eliminar_evento(evento_id):
    """Verificar si un evento puede ser eliminado"""
    try:
        cursor = db.session.connection().connection.cursor()
        
        # Verificar artículos asociados
        cursor.execute(
            "SELECT COUNT(*) FROM evento_articulos WHERE id_evento = %s", 
            (evento_id,)
        )
        tiene_articulos = cursor.fetchone()[0] > 0
        
        # Verificar pagos asociados
        cursor.execute(
            "SELECT COUNT(*) FROM pagos WHERE id_evento = %s", 
            (evento_id,)
        )
        tiene_pagos = cursor.fetchone()[0] > 0
        
        return jsonify({
            'success': True,
            'tiene_articulos': tiene_articulos,
            'tiene_pagos': tiene_pagos
        })
        
    except Exception as e:
        print(f"Error en puede_eliminar_evento: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/eventos/<int:evento_id>', methods=['DELETE'])
def eliminar_evento(evento_id):
    """Eliminar un evento y sus relaciones"""
    try:
        cursor = db.session.connection().connection.cursor()
        
        # Verificar que el evento existe
        cursor.execute(
            "SELECT id_evento FROM eventos WHERE id_evento = %s", 
            (evento_id,)
        )
        
        if not cursor.fetchone():
            return jsonify({
                'success': False, 
                'message': 'Evento no encontrado'
            }), 404
        
        # PostgreSQL con ON DELETE CASCADE manejará las eliminaciones relacionadas
        # Esto eliminará automáticamente:
        # - evento_articulos
        # - evento_servicios
        # - pagos
        # - reportes_problemas
        cursor.execute(
            "DELETE FROM eventos WHERE id_evento = %s", 
            (evento_id,)
        )
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': 'Evento eliminado correctamente'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error en eliminar_evento: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


# ===============================================
# ENDPOINTS PARA COTIZACIONES
# ===============================================

@app.route('/api/cotizaciones/<int:cotizacion_id>', methods=['PUT'])
def actualizar_cotizacion(cotizacion_id):
    """Actualizar una cotización completa"""
    try:
        data = request.json
        cursor = db.session.connection().connection.cursor()
        
        # Verificar que la cotización existe
        cursor.execute(
            "SELECT id_cotizacion, estado FROM cotizaciones WHERE id_cotizacion = %s",
            (cotizacion_id,)
        )
        resultado = cursor.fetchone()
        
        if not resultado:
            return jsonify({
                'success': False, 
                'message': 'Cotización no encontrada'
            }), 404
        
        # Solo permitir editar borradores y enviadas
        estado_actual = resultado[1]
        if estado_actual not in ['borrador', 'enviada']:
            return jsonify({
                'success': False, 
                'message': 'Solo se pueden editar cotizaciones en borrador o enviadas'
            }), 400
        
        # Actualizar datos principales de la cotización
        cursor.execute("""
            UPDATE cotizaciones 
            SET id_cliente = %s, 
                fecha_evento = %s, 
                hora_inicio = %s, 
                hora_fin = %s,
                lugar_evento = %s, 
                numero_invitados = %s, 
                notas = %s, 
                monto_total = %s
            WHERE id_cotizacion = %s
        """, (
            data.get('id_cliente'),
            data.get('fecha_evento'),
            data.get('hora_inicio'),
            data.get('hora_fin'),
            data.get('lugar_evento'),
            data.get('numero_invitados'),
            data.get('notas'),
            data.get('monto_total'),
            cotizacion_id
        ))
        
        # Eliminar detalles existentes (artículos y servicios)
        cursor.execute(
            "DELETE FROM cotizacion_articulos WHERE id_cotizacion = %s", 
            (cotizacion_id,)
        )
        cursor.execute(
            "DELETE FROM cotizacion_servicios WHERE id_cotizacion = %s", 
            (cotizacion_id,)
        )
        
        # Insertar nuevos artículos
        articulos = data.get('articulos', [])
        for articulo in articulos:
            cursor.execute("""
                INSERT INTO cotizacion_articulos 
                (id_cotizacion, id_articulo, cantidad, precio_unitario)
                VALUES (%s, %s, %s, %s)
            """, (
                cotizacion_id, 
                articulo['id_articulo'], 
                articulo['cantidad'], 
                articulo['precio_unitario']
            ))
        
        # Insertar nuevos servicios
        servicios = data.get('servicios', [])
        for servicio in servicios:
            cursor.execute("""
                INSERT INTO cotizacion_servicios 
                (id_cotizacion, id_servicio, cantidad_horas, precio_unitario)
                VALUES (%s, %s, %s, %s)
            """, (
                cotizacion_id, 
                servicio['id_servicio'], 
                servicio['cantidad'], 
                servicio['precio_unitario']
            ))
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': 'Cotización actualizada correctamente'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error en actualizar_cotizacion: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/cotizaciones/<int:cotizacion_id>', methods=['DELETE'])
def eliminar_cotizacion(cotizacion_id):
    """Eliminar una cotización (solo borradores y rechazadas)"""
    try:
        cursor = db.session.connection().connection.cursor()
        
        # Verificar estado de la cotización
        cursor.execute(
            "SELECT estado FROM cotizaciones WHERE id_cotizacion = %s", 
            (cotizacion_id,)
        )
        resultado = cursor.fetchone()
        
        if not resultado:
            return jsonify({
                'success': False, 
                'message': 'Cotización no encontrada'
            }), 404
        
        estado = resultado[0]
        
        # Solo permitir eliminar borradores y rechazadas
        if estado not in ['borrador', 'rechazada']:
            return jsonify({
                'success': False, 
                'message': 'Solo se pueden eliminar cotizaciones en borrador o rechazadas'
            }), 400
        
        # Verificar si ya se convirtió en evento
        cursor.execute(
            "SELECT id_evento_generado FROM cotizaciones WHERE id_cotizacion = %s",
            (cotizacion_id,)
        )
        evento_generado = cursor.fetchone()[0]
        
        if evento_generado:
            return jsonify({
                'success': False,
                'message': 'No se puede eliminar una cotización que ya se convirtió en evento'
            }), 400
        
        # PostgreSQL con ON DELETE CASCADE manejará las eliminaciones relacionadas
        # Esto eliminará automáticamente:
        # - cotizacion_articulos
        # - cotizacion_servicios
        cursor.execute(
            "DELETE FROM cotizaciones WHERE id_cotizacion = %s", 
            (cotizacion_id,)
        )
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': 'Cotización eliminada correctamente'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error en eliminar_cotizacion: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


# ===============================================
# ENDPOINTS PARA ARTÍCULOS
# ===============================================

@app.route('/api/articulos/<int:articulo_id>', methods=['PUT'])
def actualizar_articulo(articulo_id):
    """Actualizar información de un artículo"""
    try:
        data = request.json
        cursor = db.session.connection().connection.cursor()
        
        # Verificar que el artículo existe
        cursor.execute(
            "SELECT id_articulo FROM articulos WHERE id_articulo = %s",
            (articulo_id,)
        )
        
        if not cursor.fetchone():
            return jsonify({
                'success': False,
                'message': 'Artículo no encontrado'
            }), 404
        
        # Actualizar artículo
        cursor.execute("""
            UPDATE articulos 
            SET codigo = %s, 
                nombre_articulo = %s, 
                precio_unitario = %s, 
                cantidad_total = %s, 
                descripcion = %s, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id_articulo = %s
        """, (
            data.get('codigo'),
            data.get('nombre_articulo'),
            data.get('precio_unitario'),
            data.get('cantidad_total'),
            data.get('descripcion'),
            articulo_id
        ))
        
        # Actualizar cantidad disponible proporcionalmente
        # cantidad_disponible = cantidad_total - cantidad_dañada
        cursor.execute("""
            UPDATE articulos 
            SET cantidad_disponible = cantidad_total - COALESCE(cantidad_dañada, 0)
            WHERE id_articulo = %s
        """, (articulo_id,))
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': 'Artículo actualizado correctamente'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error en actualizar_articulo: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/articulos/<int:articulo_id>/puede-eliminar', methods=['GET'])
def puede_eliminar_articulo(articulo_id):
    """Verificar si un artículo puede ser eliminado"""
    try:
        cursor = db.session.connection().connection.cursor()
        
        # Verificar si está en eventos
        cursor.execute(
            "SELECT COUNT(*) FROM evento_articulos WHERE id_articulo = %s", 
            (articulo_id,)
        )
        eventos_count = cursor.fetchone()[0]
        
        # Verificar si está en cotizaciones
        cursor.execute(
            "SELECT COUNT(*) FROM cotizacion_articulos WHERE id_articulo = %s", 
            (articulo_id,)
        )
        cotizaciones_count = cursor.fetchone()[0]
        
        en_uso = eventos_count > 0 or cotizaciones_count > 0
        
        return jsonify({
            'success': True,
            'en_uso': en_uso,
            'eventos_count': eventos_count,
            'cotizaciones_count': cotizaciones_count
        })
        
    except Exception as e:
        print(f"Error en puede_eliminar_articulo: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/articulos/<int:articulo_id>', methods=['DELETE'])
def eliminar_articulo(articulo_id):
    """Eliminar o desactivar un artículo"""
    try:
        cursor = db.session.connection().connection.cursor()
        
        # Verificar que el artículo existe
        cursor.execute(
            "SELECT id_articulo, nombre_articulo FROM articulos WHERE id_articulo = %s",
            (articulo_id,)
        )
        resultado = cursor.fetchone()
        
        if not resultado:
            return jsonify({
                'success': False,
                'message': 'Artículo no encontrado'
            }), 404
        
        # Verificar si está en uso en eventos
        cursor.execute(
            "SELECT COUNT(*) FROM evento_articulos WHERE id_articulo = %s", 
            (articulo_id,)
        )
        eventos_count = cursor.fetchone()[0]
        
        # Verificar si está en uso en cotizaciones
        cursor.execute(
            "SELECT COUNT(*) FROM cotizacion_articulos WHERE id_articulo = %s",
            (articulo_id,)
        )
        cotizaciones_count = cursor.fetchone()[0]
        
        en_uso = eventos_count > 0 or cotizaciones_count > 0
        
        if en_uso:
            # Si está en uso, marcarlo como inactivo en lugar de eliminarlo
            cursor.execute(
                "UPDATE articulos SET estado = 'inactivo' WHERE id_articulo = %s", 
                (articulo_id,)
            )
            mensaje = f'Artículo marcado como inactivo (usado en {eventos_count} eventos y {cotizaciones_count} cotizaciones)'
        else:
            # Si no está en uso, eliminarlo físicamente
            cursor.execute(
                "DELETE FROM articulos WHERE id_articulo = %s", 
                (articulo_id,)
            )
            mensaje = 'Artículo eliminado correctamente'
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': mensaje
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error en eliminar_articulo: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


# ===============================================
# ENDPOINT AUXILIAR - OBTENER ARTÍCULO POR ID
# ===============================================

@app.route('/api/articulos/<int:articulo_id>', methods=['GET'])
def obtener_articulo(articulo_id):
    """Obtener detalles de un artículo específico"""
    try:
        cursor = db.session.connection().connection.cursor()
        
        cursor.execute("""
            SELECT 
                a.id_articulo,
                a.codigo,
                a.nombre_articulo,
                a.id_categoria,
                a.id_subcategoria,
                a.descripcion,
                a.cantidad_total,
                a.cantidad_disponible,
                a.cantidad_dañada,
                a.precio_unitario,
                a.costo_reposicion,
                a.estado,
                c.nombre as categoria_nombre
            FROM articulos a
            LEFT JOIN categorias_articulos c ON a.id_categoria = c.id_categoria
            WHERE a.id_articulo = %s
        """, (articulo_id,))
        
        result = cursor.fetchone()
        
        if not result:
            return jsonify({
                'success': False,
                'message': 'Artículo no encontrado'
            }), 404
        
        columns = [
            'id_articulo', 'codigo', 'nombre_articulo', 'id_categoria',
            'id_subcategoria', 'descripcion', 'cantidad_total', 
            'cantidad_disponible', 'cantidad_dañada', 'precio_unitario',
            'costo_reposicion', 'estado', 'categoria_nombre'
        ]
        articulo = dict(zip(columns, result))
        
        return jsonify({
            'success': True,
            'articulo': articulo
        })
        
    except Exception as e:
        print(f"Error en obtener_articulo: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5050))
    print("Iniciando aplicación Flask...")
    app.run(host='0.0.0.0', port=port, debug=False)