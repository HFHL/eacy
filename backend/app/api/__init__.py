from flask import Blueprint

def register_blueprints(app):
    from .auth import auth_bp
    from .oss import oss_bp
    from .document import document_bp
    from .system import system_bp
    from .metadata import metadata_bp
    from .patient import patient_bp
    from .batch import batch_bp
    from .project import project_bp
    from .crf_template import crf_template_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(oss_bp, url_prefix='/api/oss')
    app.register_blueprint(document_bp, url_prefix='/api/documents')
    app.register_blueprint(system_bp, url_prefix='/api/system')
    app.register_blueprint(metadata_bp, url_prefix='/api/metadata')
    app.register_blueprint(patient_bp, url_prefix='/api/patients')
    app.register_blueprint(batch_bp, url_prefix='/api/batch')
    app.register_blueprint(project_bp, url_prefix='/api/projects')
    app.register_blueprint(crf_template_bp, url_prefix='/api/crf-templates')

