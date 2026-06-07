# Testing the Deployment Setup

## Quick Test

Run the automated test script:

```cmd
test-deployment.bat
```

This will check:
- ✅ Docker installation
- ✅ Docker Compose installation
- ✅ Required deployment files
- ✅ Environment configuration
- ✅ Docker Compose validation
- ✅ AutoDock Vina image
- ✅ Running services (if deployed)

## Manual Testing Steps

### Step 1: Pre-deployment Tests

1. **Check Docker is running:**
   ```cmd
   docker --version
   docker ps
   ```

2. **Validate configuration:**
   ```cmd
   docker-compose config
   ```

3. **Create .env file:**
   ```cmd
   copy .env.example .env
   notepad .env
   ```

   Edit at minimum:
   - `SECRET_KEY=<generate-random-key>`
   - `DEBUG=False` (for production testing)

### Step 2: Deploy

```cmd
deploy.bat
```

This will:
1. Build Docker images
2. Start PostgreSQL
3. Start Django with Gunicorn
4. Run migrations
5. Collect static files
6. Optionally create superuser

### Step 3: Verify Services

**Check running containers:**
```cmd
docker-compose ps
```

You should see:
- `repo-sudoe-postgres` (healthy)
- `repo-sudoe-web` (up)

**Check logs:**
```cmd
docker-compose logs -f web
docker-compose logs -f db
```

### Step 4: Test Application

1. **Access the application:**
   - Open browser: http://localhost:8000
   - You should see the login page

2. **Test admin panel:**
   - Go to: http://localhost:8000/admin
   - Login with superuser credentials

3. **Test database:**
   ```cmd
   docker-compose exec db psql -U admin -d repo_sudoe_ai -c "\dt"
   ```
   Should show Django tables

4. **Test Django shell:**
   ```cmd
   docker-compose exec web python manage.py shell
   ```
   ```python
   from django.contrib.auth import get_user_model
   User = get_user_model()
   print(User.objects.count())
   exit()
   ```

### Step 5: Test Vina Integration

1. **Check Vina Docker image:**
   ```cmd
   docker images | findstr "cafernandezlo/dock-tools"
   ```

2. **Test Vina execution** (if you have test files):
   ```cmd
   docker run --rm -v "%cd%":/workspace cafernandezlo/dock-tools:v1.0 vina --help
   ```

3. **Test through Django:**
   - Access the application
   - Try running a docking simulation
   - Check logs: `docker-compose logs -f web`

### Step 6: Test with Nginx (Optional)

1. **Start Nginx:**
   ```cmd
   docker-compose --profile production up -d nginx
   ```

2. **Access via Nginx:**
   - Open browser: http://localhost
   - Should see the application

3. **Check static files:**
   - Static files should load from Nginx
   - Check browser Network tab

## Common Issues and Solutions

### Issue: Port already in use
```
Error: port is already allocated
```

**Solution:**
```cmd
# Stop conflicting services
docker-compose down

# Or change port in .env
WEB_PORT=8001
DB_PORT=5433
```

### Issue: Database connection failed
```
django.db.utils.OperationalError: could not connect to server
```

**Solution:**
```cmd
# Check database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Restart database
docker-compose restart db

# Wait 10 seconds and try again
timeout /t 10
docker-compose exec web python manage.py migrate
```

### Issue: Static files not loading
```
404 Not Found: /static/...
```

**Solution:**
```cmd
# Recollect static files
docker-compose exec web python manage.py collectstatic --noinput

# If using Nginx, restart it
docker-compose restart nginx
```

### Issue: Gunicorn workers timeout
```
[CRITICAL] WORKER TIMEOUT
```

**Solution:**
Edit `gunicorn.conf.py`:
```python
timeout = 300  # Increase to 5 minutes
```

Then restart:
```cmd
docker-compose restart web
```

## Performance Testing

### Load Test with Apache Bench (if installed)

```cmd
# Test 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:8000/
```

### Memory Usage

```cmd
docker stats
```

### Database Performance

```cmd
docker-compose exec db psql -U admin -d repo_sudoe_ai

# Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Production Checklist

Before deploying to production:

- [ ] Set `DEBUG=False` in `.env`
- [ ] Generate strong `SECRET_KEY`
- [ ] Configure `ALLOWED_HOSTS`
- [ ] Use strong database passwords
- [ ] Configure email settings
- [ ] Test all features
- [ ] Test Vina docking
- [ ] Test user registration/login
- [ ] Set up SSL/HTTPS
- [ ] Configure backups
- [ ] Set up monitoring
- [ ] Test recovery procedures

## Cleanup After Testing

```cmd
# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Full cleanup
docker system prune -a
```

## Getting Help

If you encounter issues:

1. **Check logs:**
   ```cmd
   docker-compose logs -f
   ```

2. **Check service status:**
   ```cmd
   docker-compose ps
   ```

3. **Inspect container:**
   ```cmd
   docker-compose exec web bash
   ```

4. **Review configuration:**
   ```cmd
   docker-compose config
   ```

5. **Check this documentation:**
   - [DEPLOYMENT.md](DEPLOYMENT.md)
   - [TESTING.md](TESTING.md)
