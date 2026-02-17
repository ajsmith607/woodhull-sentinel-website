# Domain and Static Hosting Plans

## Overall Plan

- Cloudflare, one place for:
  - Domain name registration
  - content caching
  - analytics
- Hostinger commodity hosting (rsync upload)
- document and hand-off 

## Domains

Primary domain: woodhullsentinel.org

Other domains:
- thewoodhullsentinel.org
- woodhullsentinel.com
- thewoodhullsentinel.com

Optional domains:
- woodhullsentinel.net

## Implementation Checklist

### Account Setup 

**Domain Registration:**
- [ ] Client creates Cloudflare account
- [ ] Register domain name (e.g., clientsite.org)
- [ ] Add you as Administrator to Cloudflare account
- [ ] Configure Cloudflare nameservers
- [ ] Enable WHOIS privacy protection
- [ ] Set domain to auto-renew
- [ ] Add renewal reminder to calendar (60 days before)

**Hostinger Setup:**
- [ ] Client creates Hostinger account
- [ ] Purchase Premium Shared Hosting (48-month plan for best rate)
- [ ] Add you as technical contact
- [ ] Note cPanel login credentials
- [ ] Create FTP account for file uploads
- [ ] Install SSL certificate (free via Hostinger)

**Cloudflare Configuration:**
- [ ] Add domain to Cloudflare
- [ ] Configure DNS records:
  - [ ] add A record for static.clientsite.org → Hostinger IP
- [ ] Enable proxy (orange cloud) for CDN
- [ ] Configure SSL/TLS settings (Full)
- [ ] Set up Cloudflare caching rules

**Final Checks:**
- [ ] Test all pages on mobile and desktop
- [ ] Verify SSL certificates working
- [ ] Check site speed (Google PageSpeed Insights)
- [ ] Submit sitemap to Google Search Console
- [ ] Test backup export process

---

## Technical Notes

### DNS Configuration Example

```
# DNS Records at Cloudflare for clientsite.org

# Static site (Hostinger)
A     static         → [Hostinger IP from cPanel]
CNAME assets         → static.clientsite.org

# SSL
TXT   @              → [SSL verification records if needed]
```

### Cloudflare Configuration Tips

**Recommended Settings:**
- SSL/TLS mode: Full (strict) if possible, Full if needed
- Always Use HTTPS: On
- Auto Minify: CSS, JavaScript, HTML
- Brotli compression: On
- Caching level: Standard
- Browser Cache TTL: 4 hours

**Page Rules (if needed):**
- Cache everything for static subdomain
- Forward www to non-www (or vice versa)

### Asset Optimization

**Delegation to Cloudflare:**
All optimization handled at Cloudflare edge, zero build-time configuration.

**Cloudflare Auto Minify (Enable in Dashboard):**
- HTML minification: Remove whitespace, comments
- CSS minification: Remove whitespace, shorten names
- JavaScript minification: Minify but preserve readability of stack traces

**Cloudflare Compression:**
- Brotli compression (preferred, ~20% better than gzip)
- Gzip fallback for older clients
- Automatic based on Accept-Encoding header
- documents.json compresses from ~70 MB to ~5-10 MB

**Cloudflare Caching:**
- Static assets cached at edge globally
- Configurable TTL via Cache-Control headers
- Purge cache manually or via API when deploying updates

**Cache-Control Headers (Optional):**
Set via `_headers` file in project root for Cloudflare Pages:
```
/data/documents.json
  Cache-Control: public, max-age=3600

/data/JPEGs/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: public, max-age=0, must-revalidate

/css/*
  Cache-Control: public, max-age=31536000

/js/*
  Cache-Control: public, max-age=31536000
```

**Images:**
- Serve JPEGs as-is (assume already optimized)
- Lazy load with `loading="lazy"` attribute or Intersection Observer
- Cloudflare can apply Polish (image optimization) if enabled
- Progressive JPEG encoding recommended for better perceived performance

### Hostinger Server Details

After Hostinger setup, note:
- Server name: [e.g., srv123.hostinger.com]
- Server IP: [from cPanel]
- FTP hostname: [from cPanel]
- Database host (if needed): [from cPanel]

### Account Documentation Template

Create a shared document (Google Doc, in Dropbox, or in password manager notes) with this information:

```markdown
# Website Services Access Information

**Last Updated:** [Date]
**Primary Owner:** [Client Name]
**Technical Contact:** [Technical Contact Name]

## Hostinger
- **Account Email:** client@example.org
- **Control Panel URL:** https://hpanel.hostinger.com
- **Plan:** Premium Shared Hosting
- **Renewal Date:** [Date]
- **Server:** [Server name/IP]
- **Support Contact:** support@hostinger.com
- **FTP Details:** [Stored in password manager]

## Domain Name
- **Domain:** clientsite.com
- **Registrar:** Cloudflare Registrar
- **Account Email:** client@example.org
- **Renewal Date:** [Date]
- **Nameservers:** [Cloudflare nameservers]
- **Support Contact:** https://dash.cloudflare.com/

## Cloudflare (CDN/Security)
- **Account Email:** client@example.org
- **Website:** clientsite.com
- **Plan:** Free
- **Dashboard:** https://dash.cloudflare.com/

## Emergency Contacts
- **Technical Support:** [name] - name@email.com - [Phone]
- **Backup Technical Contact:** [Name] - [Email] - [Phone]
- **Hostinger Support:** 24/7 live chat
- **Domain Transfer Auth Code:** [Stored securely in password manager]

## Important Notes
- All services set to auto-renew
- Backup credentials stored in [Password Manager Name]

```

**Other Possible Documentation to Provide Client:**
- Simple "Quick Reference" guide for common tasks
- Contact sheet with all support numbers/emails

### Technical Support Transition Planning 

Create a technical handoff document that includes:

1. **Service Overview:**
   - What each service does
   - How they connect together
   - Monthly costs

2. **Access Information:**
   - Where credentials are stored
   - How to request access from client
   - Login URLs for each service

3. **Recurring Tasks:**
   - Backup procedures (from Backup Strategy section)
   - What to monitor
   - Common troubleshooting

4. **Annual Renewals:**
   - Renewal calendar
   - How to verify auto-renewal is enabled
   - What to do if payment fails

5. **Emergency Procedures:**
   - Site down? Check Cloudflare status, then Hostinger
   - Email not working? Check domain DNS settings
   - Can't access service? Contact support with account email


