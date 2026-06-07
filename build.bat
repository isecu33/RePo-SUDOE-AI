@echo off
echo Building React application...
cd frontend\react
call npm run build

echo Collecting static files...
cd ..
cd ..
python manage.py collectstatic --noinput

echo Build complete!