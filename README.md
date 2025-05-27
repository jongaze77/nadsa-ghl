# GHL Client Manager

A Next.js application for managing Go High Level (GHL) client records, featuring contact management, custom fields, and notes.

## Features

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
GHL_API_KEY=your_api_key_here
GHL_LOCATION_ID=your_location_id_here
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
   - Click "Deploy"

3. Vercel will automatically deploy your application and provide you with a URL

## Security Notes

- Never commit your `.env.local` file
- Keep your GHL API key secure
- The application uses server-side API routes to protect your API key

## License

MIT
