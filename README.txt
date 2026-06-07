# Molecular Docking Project

## Setup Development Environment

1. Create and activate virtual environment:
```bash
python -m venv env
.\env\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
cd frontend/react
npm install
```

3. Create .env file:
```bash
copy .env.example .env
```

4. Run migrations:
```bash
python manage.py migrate
```

5. Run development servers:
```bash
# Django (in one terminal)
python manage.py runserver

# React (in another terminal)
cd frontend/react
npm run dev
```