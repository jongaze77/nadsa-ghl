# GHL Client Manager

A Next.js application for managing Go High Level (GHL) client records, featuring contact management, custom fields, and notes.

## Features

- Secure login system
- Search and filter contacts
- Edit standard and custom contact fields
- View and add contact notes
- Accessible, high-contrast UI
- Responsive design

## Prerequisites

- Node.js 18+ and npm
- Go High Level API key
- Go High Level Location ID
- Vercel account (for deployment)

## Environment Variables

Create a `.env.local` file in the root directory with:

```env
# GHL API Configuration
GHL_API_KEY=your_api_key_here
GHL_LOCATION_ID=your_location_id_here

# Authentication
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_hashed_password_here
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3000
```

To generate a hashed password, you can use the following command:
```bash
node -e "console.log(require('bcryptjs').hashSync('your_password_here', 10))"
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

1. Push your code to a GitHub repository

2. Go to [Vercel](https://vercel.com) and:
   - Sign up/Login with your GitHub account
   - Click "New Project"
   - Import your repository
   - Add your environment variables:
     - `GHL_API_KEY`
     - `GHL_LOCATION_ID`
     - `ADMIN_USERNAME`
     - `ADMIN_PASSWORD` (hashed)
     - `NEXTAUTH_SECRET` (generate a random string)
     - `NEXTAUTH_URL` (your Vercel deployment URL)
   - Click "Deploy"

3. Vercel will automatically deploy your application and provide you with a URL

## Security Notes

- Never commit your `.env.local` file
- Keep your GHL API key secure
- Use strong passwords for admin access
- The application uses server-side API routes to protect your API key
- All routes are protected by authentication
- Passwords are hashed using bcrypt

## License

MIT
