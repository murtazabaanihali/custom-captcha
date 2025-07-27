
# Custom Captcha

A customizable sliding puzzle captcha component for React applications with server-side validation. Perfect for preventing bot registrations and enhancing form security.

![Custom Captcha Demo](https://img.shields.io/badge/captcha-sliding%20puzzle-blue)
![TypeScript](https://img.shields.io/badge/typescript-support-blue)
![React](https://img.shields.io/badge/react-%3E%3D16.8.0-blue)

## 🧩 Features

- 🎯 **Sliding puzzle captcha** with random puzzle piece positioning
- 🔒 **Server-side validation** for enhanced security
- ⚡ **TypeScript support** with comprehensive type definitions
- 🎨 **Customizable styling** with CSS variables
- 📱 **Responsive design** that works on all devices
- 🚀 **Easy integration** with any React project
- 🛡️ **Replay attack prevention** with unique captcha IDs
- 🖼️ **Flexible image sources** (API, local files, custom images)

## 📦 Installation

```bash
npm install custom-captcha
```

## 🔄 How It Works

This captcha system follows a secure workflow:

1. **User Registration Flow**: User navigates to signup page and fills credentials
2. **Captcha Challenge**: User clicks "Verify you're human" to open the captcha
3. **Server Request**: Client requests new captcha data from server
4. **Puzzle Generation**: Server generates random puzzle piece position and stores solution
5. **User Interaction**: User slides puzzle piece to correct position
6. **Verification**: Server validates the position and marks captcha as verified
7. **Registration**: Server checks captcha verification status before allowing signup

## 🚀 Quick Start Examples

### Next.js App Router Example

#### Client Component (`components/SignupForm.tsx`)

```tsx
'use client';

import { useState } from 'react';
import CaptchaComponent from 'custom-captcha/client';

export default function SignupForm() {
  const [loading, setLoading] = useState(false);
  const [captchaId, setCaptchaId] = useState<string>('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/captcha/create', { 
        method: 'POST' 
      });
      const data = await response.json();
      setCaptchaId(data.id);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: string, value: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/captcha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, value })
      });
      return await response.json();
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...formData, 
        captchaId 
      })
    });

    if (response.ok) {
      alert('Signup successful!');
    } else {
      const error = await response.json();
      alert(error.message);
    }
  };

  return (
    <form onSubmit={handleSignup} className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Sign Up</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          className="w-full p-2 border rounded"
          required
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          className="w-full p-2 border rounded"
          required
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Password</label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          className="w-full p-2 border rounded"
          required
        />
      </div>

      <div className="mb-6">
        <CaptchaComponent
          loading={loading}
          refreshCaptcha={handleRefresh}
          verifyCaptcha={handleVerify}
        />
      </div>

      <button
        type="submit"
        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
      >
        Sign Up
      </button>
    </form>
  );
}
```

#### API Routes

**Create Captcha (`app/api/captcha/create/route.ts`)**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createCaptcha } from 'custom-captcha/server';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function POST(request: NextRequest) {
  try {
    const captcha = await createCaptcha({
      fallbackImgPath: './public/fallback.jpg',
      storeCaptchaId: async (id, value) => {
        await redis.setex(`captcha:${id}`, 600, value); // 10 minute TTL
      }
    });
    
    return NextResponse.json(captcha);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create captcha' }, 
      { status: 500 }
    );
  }
}
```

**Verify Captcha (`app/api/captcha/verify/route.ts`)**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyCaptcha } from 'custom-captcha/server';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function POST(request: NextRequest) {
  try {
    const { id, value } = await request.json();
    
    const result = await verifyCaptcha({
      captchaId: id,
      value,
      getCaptchaValue: async (id) => {
        return await redis.get(`captcha:${id}`);
      },
      changeCaptchaIdOnSuccess: async (id, value) => {
        await redis.setex(`captcha:${id}`, 600, value);
      }
    });
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Verification failed' }, 
      { status: 500 }
    );
  }
}
```

**Signup Route (`app/api/auth/signup/route.ts`)**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { hasCaptchaBeenVerified } from 'custom-captcha/server';
import Redis from 'ioredis';
import bcrypt from 'bcryptjs';

const redis = new Redis(process.env.REDIS_URL);

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, captchaId } = await request.json();
    
    // Verify captcha first
    const captchaValue = await redis.get(`captcha:${captchaId}`);
    
    if (!captchaValue || !(await hasCaptchaBeenVerified(captchaValue))) {
      return NextResponse.json(
        { message: 'Please complete the captcha verification' }, 
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { message: 'User already exists' }, 
        { status: 400 }
      );
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await createUser({ email, password: hashedPassword, name });
    
    // Clean up captcha, it will work without it also but it is good to remove it
    await redis.del(`captcha:${captchaId}`);

    return NextResponse.json({ 
      message: 'User created successfully', 
      userId: user.id 
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
```

### React + Express.js + Redis Example

#### React Component (`src/components/SignupForm.jsx`)

```jsx
import React, { useState } from 'react';
import CaptchaComponent from 'custom-captcha/client';

function SignupForm() {
  const [loading, setLoading] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/captcha/create', { 
        method: 'POST' 
      });
      const data = await response.json();
      setCaptchaId(data.id);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id, value) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/captcha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, value })
      });
      return await response.json();
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    const response = await fetch('http://localhost:5000/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...formData, 
        captchaId 
      })
    });

    if (response.ok) {
      alert('Signup successful!');
    } else {
      const error = await response.json();
      alert(error.message);
    }
  };

  return (
    <form onSubmit={handleSignup}>
      <h2>Sign Up</h2>
      
      <div>
        <label>Name:</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
      </div>

      <div>
        <label>Email:</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          required
        />
      </div>

      <div>
        <label>Password:</label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          required
        />
      </div>

      <div>
        <CaptchaComponent
          loading={loading}
          refreshCaptcha={handleRefresh}
          verifyCaptcha={handleVerify}
        />
      </div>

      <button type="submit">Sign Up</button>
    </form>
  );
}

export default SignupForm;
```

#### Express.js Server (`server.js`)

```javascript
const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const bcrypt = require('bcryptjs');
const { createCaptcha, verifyCaptcha, hasCaptchaBeenVerified } = require('custom-captcha/server');

const app = express();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

app.use(cors());
app.use(express.json());

// Create captcha endpoint
app.post('/captcha/create', async (req, res) => {
  try {
    const captcha = await createCaptcha({
      fallbackImgPath: './assets/fallback.jpg',
      storeCaptchaId: async (id, value) => {
        await redis.setex(`captcha:${id}`, 600, value);
      }
    });
    
    res.json(captcha);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create captcha' });
  }
});

// Verify captcha endpoint
app.post('/captcha/verify', async (req, res) => {
  try {
    const { id, value } = req.body;
    
    const result = await verifyCaptcha({
      captchaId: id,
      value,
      getCaptchaValue: async (id) => {
        return await redis.get(`captcha:${id}`);
      },
      changeCaptchaIdOnSuccess: async (id, value) => {
        await redis.setex(`captcha:${id}`, 600, value);
      }
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Signup endpoint
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, name, captchaId } = req.body;
    
    // Verify captcha
    const captchaValue = await redis.get(`captcha:${captchaId}`);
    
    if (!captchaValue || !(await hasCaptchaBeenVerified(captchaValue))) {
      return res.status(400).json({ 
        message: 'Please complete the captcha verification' 
      });
    }

    // Check if user exists (implement your user checking logic)
    const existingUser = await checkUserExists(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await createUser({ email, password: hashedPassword, name });
    
    // Clean up captcha
    await redis.del(`captcha:${captchaId}`);

    res.json({ message: 'User created successfully', userId: user.id });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.listen(5000, '0.0.0.0', () => {
  console.log('Server running on http://0.0.0.0:5000');
});
```

### NestJS Example

#### Controller (`src/captcha/captcha.controller.ts`)

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { CaptchaService } from './captcha.service';

@Controller('captcha')
export class CaptchaController {
  constructor(private readonly captchaService: CaptchaService) {}

  @Post('create')
  async createCaptcha() {
    return this.captchaService.createCaptcha();
  }

  @Post('verify')
  async verifyCaptcha(@Body() body: { id: string; value: string }) {
    return this.captchaService.verifyCaptcha(body.id, body.value);
  }
}
```

#### Service (`src/captcha/captcha.service.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { createCaptcha, verifyCaptcha } from 'custom-captcha/server';
import Redis from 'ioredis';

@Injectable()
export class CaptchaService {
  private redis = new Redis(process.env.REDIS_URL);

  async createCaptcha() {
    return createCaptcha({
      fallbackImgPath: './assets/fallback.jpg',
      storeCaptchaId: async (id, value) => {
        await this.redis.setex(`captcha:${id}`, 600, value);
      }
    });
  }

  async verifyCaptcha(id: string, value: string) {
    return verifyCaptcha({
      captchaId: id,
      value,
      getCaptchaValue: async (id) => {
        return await this.redis.get(`captcha:${id}`);
      },
      changeCaptchaIdOnSuccess: async (id, value) => {
        await this.redis.setex(`captcha:${id}`, 600, value);
      }
    });
  }
}
```

## 🛠️ API Reference

### Client Component Props

```typescript
interface CustomCaptchaProps {
  loading: boolean;
  refreshCaptcha: () => Promise<{
    background: string;  // Base64 or URL of background image
    puzzle: string;      // Base64 or URL of puzzle piece
    id: string;          // Unique captcha identifier
  }>;
  verifyCaptcha: (id: string, value: string) => Promise<{
    success?: boolean;   // Verification success status
    error?: string;      // Error message if verification fails
  }>;
}
```

### Server Functions

#### `createCaptcha(options)`

Creates a new sliding puzzle captcha with random positioning.

```typescript
interface CreateCaptchaProps {
  image?: Buffer;                                    // Custom image buffer
  captchaId?: string;                               // Custom captcha ID
  fallbackImgPath?: string;                         // Local fallback image
  storeCaptchaId: (id: string, value: string) => Promise<void>; // Storage function
}

// Returns
interface CaptchaData {
  puzzle: string;      // Base64 encoded puzzle piece
  background: string;  // Base64 encoded background
  id: string;          // Unique captcha ID
}
```

#### `verifyCaptcha(options)`

Verifies the user's captcha solution.

```typescript
interface VerifyCaptchaProps {
  captchaId: string;                                       // Captcha ID to verify
  value: string;                                           // User's slider position
  getCaptchaValue: (id: string) => Promise<string | null>; // Retrieve stored value
  changeCaptchaIdOnSuccess: (id: string, value: string) => Promise<void>; // Mark as verified
  tolerance?: number;                                      // Position tolerance (default: 10px)
}

// Returns
interface VerificationResult {
  success: boolean;  // Verification success
  reason?: string;   // Failure reason
}
```

#### `hasCaptchaBeenVerified(value)`

Utility to check if a captcha has been successfully verified.

```typescript
hasCaptchaBeenVerified(value: string): Promise<boolean>
```

## 🎨 Styling Customization

The component uses CSS variables for easy theming:

```css
:root {
  --primary-blue: #3b82f6;
  --primary-blue-dark: #2563eb;
  --primary-blue-darker: #1d4ed8;
  --gray-50: #f8fafc;
  --gray-100: #f1f5f9;
  --gray-200: #e2e8f0;
  --gray-300: #cbd5e1;
  --gray-400: #94a3b8;
  --gray-500: #64748b;
  --gray-600: #475569;
  --red-500: #ef4444;
  --white: #ffffff;
}

/* Override for dark theme */
.dark {
  --primary-blue: #60a5fa;
  --gray-50: #0f172a;
  --gray-100: #1e293b;
  /* ... etc */
}
```

## 🔒 Security Features

- **Server-side validation** prevents client-side bypassing
- **Unique captcha IDs** prevent replay attacks
- **Time-based expiration** limits captcha lifespan
- **Position tolerance** accounts for user precision
- **Rate limiting ready** (implement in your routes)

## 📄 License

MIT © Murtaza Baanihali

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/murtazabaanihali/custom-captcha/issues)
- **Documentation**: [GitHub Wiki](https://github.com/murtazabaanihali/custom-captcha/wiki)
---

**Made with ❤️ By Murtaza Baanihali for the React community**