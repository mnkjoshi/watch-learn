# How to Replace Training Videos

The application uses stock CCTV and security camera footage for the Video Report practice module. Since downloading high-quality, perfectly specific, public-domain surveillance footage is difficult via automated scripts, the application defaults to generic public domain footage.

If you have acquired or purchased your own specific training videos (e.g., actors portraying a shoplifting incident, a simulated break-in, etc.), it is very easy to add them to the application.

## 1. Add your Video Files

1. Obtain your video files. For best browser compatibility across all platforms (Windows, macOS, Linux, iOS), use the **MP4** (`.mp4`) or **WebM** (`.webm`) format.
2. Place the video files in the `public/videos/` directory of the application:
   ```
   watch-learn/
     public/
       videos/
         my-custom-video.mp4      <-- (Add your files here)
         another-incident.webm
   ```

## 2. Update the Scenario Data

The application loads the video scenarios from `data/videos.ts`. You need to edit this file to reference your new videos and define the grading rubrics for them.

Open `data/videos.ts` and locate the `VIDEO_SCENARIOS` array.

You can modify an existing entry or add a new one. Here is the structure:

```typescript
{
  id: "my-custom-scenario", // A unique ID for the video
  title: "Simulated Shoplifting Incident", // Displayed on the choice card
  briefing:
    "You are observing Camera 4 in the electronics department. Watch the suspect and detail their actions.", // Shown before the video plays
  difficulty: "advanced", // Choose "beginner", "intermediate", or "advanced"
  videoUrl: "/videos/my-custom-video.mp4", // MUST match the filename in public/videos/ exactly
  credit: "In-house training video", // Attribution text
  durationSec: 45, // Length of the video in seconds
  
  // The "Ideal Report" is used by the AI as the gold standard for grading.
  // Describe EXACTLY what happens in the video in professional security language.
  idealReport:
    "At 14:05, a male subject wearing a red jacket entered the electronics aisle. The subject picked up a pair of headphones, concealed them inside his jacket, and proceeded past the last point of sale without attempting to pay. I immediately notified the floor manager and continued observing via CCTV.",
  
  // Key details are bullet points the AI specifically looks for to assign points.
  keyDetails: [
    "Male subject in red jacket",
    "Electronics aisle",
    "Concealed headphones in jacket",
    "Passed point of sale without paying",
    "Notified floor manager"
  ],
  manualSection: "Loss Prevention & Observation",
}
```

## 3. Test the Scenario

Once you save `data/videos.ts`, the application will automatically reload if the development server is running (`npm run dev`). 

Navigate to the `http://localhost:3005/report` page. Your new scenario will appear as a card. Watch the video, write a test report, and ensure the AI grades it accurately against the `idealReport` and `keyDetails` you provided.

## Tips for Ideal Grading
* Ensure the `idealReport` matches the actual visual contents of the video exactly, so students aren't penalized for missing things they couldn't possibly see.
* Keep `keyDetails` concise and factual.
