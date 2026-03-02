# Two-Step OTP Authentication Guide

## Overview
This implementation adds a two-step email-based OTP (One-Time Password) authentication system with reCAPTCHA v2 protection.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Update your `.env` file with email configuration:

```env
# Gmail Setup (Recommended)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_specific_password

# For Gmail, generate an App Password:
# 1. Go to myaccount.google.com
# 2. Select "Security" from the left menu
# 3. Enable 2-Step Verification
# 4. Look for "App passwords"
# 5. Generate password for "Mail" and "Windows Computer"
# 6. Use this password in EMAIL_PASSWORD
```

### 3. MongoDB Setup
Ensure your MongoDB connection is configured:
```env
MONGO_URI=mongodb://localhost:27017/gauth
```

## API Endpoints

### Step 1: Request OTP
**Endpoint:** `POST /api/users/request-otp`

**Request Body:**
```json
{
  "email": "user@example.com",
  "recaptchaToken": "recaptcha_v2_token_here"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP sent to your email",
  "email": "user@example.com",
  "expiresIn": 600
}
```

**Response (Error):**
```json
{
  "success": false,
  "code": "INVALID_EMAIL",
  "message": "Invalid email format"
}
```

### Step 2: Verify OTP
**Endpoint:** `POST /api/users/verify-otp`

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "email": "user@example.com",
  "authToken": "base64_encoded_token",
  "verifiedAt": "2024-02-27T10:30:00Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "code": "INVALID_OTP",
  "message": "Invalid or expired OTP"
}
```

### Step 3: Resend OTP (Optional)
**Endpoint:** `POST /api/users/resend-otp`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP resent to your email",
  "email": "user@example.com",
  "expiresIn": 550
}
```

## Database Schema

### OTP Table
Stores all OTP records (audit trail maintained):
- `_id`: MongoDB ObjectId
- `email`: User email (indexed for quick lookups)
- `otp`: Generated OTP code
- `expiresAt`: Expiration timestamp (auto-delete after expiry)
- `isUsed`: Boolean flag to prevent OTP reuse
- `createdAt`: Timestamp when OTP was created
- `usedAt`: Timestamp when OTP was verified

### User Table
Remains unchanged - stores user profile information after successful authentication.

## Flow Architecture

```
Client Request
    ↓
reCAPTCHA v2 Verification
    ↓
Email Validation
    ↓
OTP Generation (6 digits)
    ↓
Save to OTP Table
    ↓
Send Email via Nodemailer
    ↓
User receives OTP
    ↓
User submits OTP
    ↓
Verify against OTP Table
    ↓
Mark as Used (no reuse possible)
    ↓
Generate Auth Token
    ↓
(Optional) Save to User Table
```

## Key Features

1. **Separate OTP Table**: All OTP records are stored separately for audit purposes
2. **Auto-Expiry**: OTPs automatically expire after 10 minutes
3. **One-Time Use**: Once used, an OTP cannot be used again
4. **Email Verification**: Real email validation before sending OTP
5. **reCAPTCHA Protection**: Prevents automated OTP requests
6. **Audit Trail**: Complete history of all OTP requests and verifications
7. **Resend Functionality**: Users can request OTP resend if needed

## Email Service Configuration

### Gmail (Recommended for development)
1. Enable 2-Step Verification
2. Generate App-Specific Password
3. Use the generated password in `.env`

### Outlook/Hotmail
```env
EMAIL_SERVICE=outlook
EMAIL_USER=your_email@outlook.com
EMAIL_PASSWORD=your_password
```

### Custom SMTP Server
```env
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=your_email@example.com
EMAIL_PASSWORD=your_password
```

## Security Considerations

1. **OTP Length**: 6 digits (adjustable in `otpGenerator.ts`)
2. **Expiration**: 10 minutes (adjustable in `otpController.ts`)
3. **reCAPTCHA**: Prevents bot attacks on step 1
4. **One-time Use**: OTPs cannot be reused
5. **Database Logging**: All requests are logged for auditing
6. **Email Validation**: Basic regex validation before sending

## Testing

### Using cURL
```bash
# Step 1: Request OTP
curl -X POST http://localhost:5000/api/users/request-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "recaptchaToken": "your_recaptcha_token"
  }'

# Step 2: Verify OTP
curl -X POST http://localhost:5000/api/users/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456"
  }'

# Step 3: Resend OTP
curl -X POST http://localhost:5000/api/users/resend-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

## Error Codes

| Code | Description |
|------|-------------|
| EMAIL_MISSING | Email not provided |
| INVALID_EMAIL | Email format is invalid |
| RECAPTCHA_FAILED | reCAPTCHA verification failed |
| EMAIL_SEND_FAILED | Failed to send OTP email |
| INVALID_OTP | OTP is invalid or expired |
| MISSING_FIELDS | Required fields missing |
| NO_ACTIVE_OTP | No active OTP found for resend |

## Next Steps

1. **Update Frontend**: Implement the two-step flow in your client
2. **JWT Integration**: Replace base64 token with JWT for better security
3. **Rate Limiting**: Add rate limiting to prevent abuse
4. **Database Indexing**: Verify indexes are created for performance
5. **Monitoring**: Set up email delivery monitoring
