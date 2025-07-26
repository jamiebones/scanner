# Security Guidelines

## Environment Variables

**NEVER commit the following files:**

- `.env` - Contains sensitive API keys and configuration
- Any files with API keys, secrets, or credentials

**Always use environment variables for:**

- RPC endpoint URLs with API keys
- Database credentials
- Any third-party service credentials
- Private keys or sensitive configuration

## API Security

### Rate Limiting

- API endpoints are rate-limited to 100 requests per minute per IP
- Adjust `RATE_LIMIT` environment variable if needed

### CORS Configuration

- CORS is configured to only allow requests from `http://localhost:3000` by default
- Set `CORS_ORIGIN` environment variable for production

### Security Headers

The following security headers are automatically set:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Data Protection

### Sensitive Data Masking

- API keys in URLs are automatically masked in logs
- Sensitive fields are excluded from API responses
- All logging goes through security filters

### Database Security

- Database files are excluded from version control
- Use strong passwords for production databases
- Regularly backup and encrypt database files

## Network Security

### RPC Endpoints

- Use HTTPS endpoints only
- Prefer paid providers (Alchemy, Infura) over public endpoints
- Rotate API keys regularly
- Monitor API usage for unusual activity

### WebSocket Security

- WebSocket connections are limited to configured origins
- No sensitive data is transmitted over WebSocket

## Production Deployment

### Environment Setup

```bash
# Set production environment
NODE_ENV=production

# Use secure RPC endpoints
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_SECURE_API_KEY
ETHEREUM_WS_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_SECURE_API_KEY

# Configure CORS for your domain
CORS_ORIGIN=https://yourdomain.com

# Set appropriate rate limits
RATE_LIMIT=1000
```

### SSL/TLS

- Always use HTTPS in production
- Use valid SSL certificates
- Enable HSTS headers (already configured)

### Monitoring

- Monitor API usage and rate limits
- Set up alerts for unusual activity
- Regularly review logs for security issues

## Security Checklist

- [ ] `.env` file is not committed to version control
- [ ] API keys are stored in environment variables only
- [ ] CORS is configured for production domain
- [ ] Rate limiting is enabled and configured
- [ ] Security headers are enabled
- [ ] Database files are excluded from version control
- [ ] Logs are monitored for sensitive data leaks
- [ ] SSL/TLS is enabled in production
- [ ] API keys are rotated regularly

## Reporting Security Issues

If you discover a security vulnerability, please:

1. Do not create a public GitHub issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before public disclosure

## Security Updates

- Regularly update dependencies: `npm audit fix`
- Monitor security advisories for used packages
- Keep Node.js runtime updated
- Review and update security configurations periodically
