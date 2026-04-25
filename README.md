# ABST Coach

ABST Coach is a scenario based exam coach for ESL students preparing for the Alberta Basic Security Training provincial exam.

## How it Works

ABST Coach provides students with tools to practice their comprehension and articulation in English. It offers reading level adaptation for the provincial manual, a voice driven scenario simulator, adaptive quizzes, and full practice exams. Students can study the official material, answer situational questions, and receive targeted feedback on both their conceptual understanding and vocabulary gaps. 

## Technology Stack

### Frontend
The frontend is built using Next.js and React. It utilizes Tailwind CSS for styling, providing a responsive and modern user interface designed to help students focus on their studies without distractions.

### Backend
The backend leverages Next.js API Routes for serverless execution. 

### Cloud Infrastructure
The application relies heavily on Amazon Web Services (AWS) for its core functionality:
* Amazon EC2: Hosts the continuous deployment environment and serves the application to users.
* Amazon Bedrock: Powers the generative AI features, evaluating situational judgement and providing targeted explanations for quiz answers.
* Amazon Transcribe: Used in the scenario simulators to handle voice driven interactions and grade spoken incident reporting.

## Project Structure

The project follows a standard Next.js directory layout:
* /app: Contains the Next.js frontend pages and API routes.
* /data: Holds the static JSON data sets used for quizzes and practice exams.
* /lib: Contains shared utility functions, session management, and AWS integration helpers.
* /components: Contains reusable React UI elements.

## How to Setup

1. Install Dependencies
Run the following command to install required Node packages:
npm install

2. Configure Environment Variables
Copy the example environment file and fill in your AWS credentials. If you want to use mock data for testing, set the DEMO_MODE flag to true.
cp .env.example .env.local

3. Prepare Data
If you need to update the manual, place the PDF in the data folder and run the preparation script:
node scripts/prepare_abst.mjs

4. Start Development Server
Run the local development server to see the app in action:
npm run dev

Open http://localhost:3000 in your browser to view the application.
