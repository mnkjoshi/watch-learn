// data/videos.ts
//
// Curated stock videos depicting security-relevant scenarios.
// Each video has an ideal incident report and a list of key details
// the student should identify in their written report.

export interface VideoScenario {
  id: string;
  title: string;
  /** Short context shown to the student before the video plays */
  briefing: string;
  /** Difficulty tag */
  difficulty: "beginner" | "intermediate" | "advanced";
  /** Video URL — local path or external link for embedding */
  videoUrl: string;
  /** Video attribution */
  credit: string;
  /** Approximate duration in seconds */
  durationSec: number;
  /** The "gold standard" incident report a trained guard would write */
  idealReport: string;
  /** Key observable details the student should mention */
  keyDetails: string[];
  /** Which ABST manual section this relates to */
  manualSection: string;
}

export const VIDEO_SCENARIOS: VideoScenario[] = [
  {
    id: "rooftop-parking",
    title: "Rooftop Parking Observation",
    briefing:
      "You are reviewing security camera footage from a rooftop parking structure. Watch the video carefully and write an incident report describing the environment and any vehicle activity you observe.",
    difficulty: "beginner",
    videoUrl: "/videos/rooftop-parking.mp4",
    credit: "Creative Commons / Public Domain stock footage",
    durationSec: 30,
    idealReport:
      "At approximately [time], I observed surveillance footage of a rooftop parking structure. Several vehicles are parked in designated bays. The parking surface is concrete and exposed to the open sky. No active pedestrians or unusual activities were immediately noted in the field of view. Lighting appears adequate. I will continue to log routine observations for this sector.",
    keyDetails: [
      "Rooftop or elevated parking structure",
      "Multiple parked vehicles",
      "Concrete or open-sky environment",
      "No suspicious pedestrians observed",
      "Routine observation logging",
    ],
    manualSection: "Patrol Procedures & Observation",
  },
  {
    id: "mall-interior",
    title: "Shopping Mall Concourse",
    briefing:
      "You are assigned to monitor the CCTV feed of a busy shopping mall concourse. Watch carefully and describe the general foot traffic and environment in a written report.",
    difficulty: "intermediate",
    videoUrl: "/videos/mall-interior.mp4",
    credit: "Creative Commons / Public Domain stock footage",
    durationSec: 23,
    idealReport:
      "At approximately [time], I observed the indoor concourse of the shopping mall via CCTV. Multiple patrons are walking through the main corridor. Several storefronts are visible and well-lit. The foot traffic is steady and typical for normal operating hours. No individuals appear to be loitering, and no hazards are present in the walkways. Normal operations are ongoing.",
    keyDetails: [
      "Indoor mall concourse",
      "Multiple patrons / pedestrians walking",
      "Steady, normal foot traffic",
      "Storefronts visible in the background",
      "No trip hazards or loitering observed",
    ],
    manualSection: "Observation & Reporting",
  },
  {
    id: "ne-parking",
    title: "Ground Parking Surveillance",
    briefing:
      "Review the following security camera export from a standard ground-level parking lot. Describe the layout, environment, and any notable activity.",
    difficulty: "beginner",
    videoUrl: "/videos/ne-parking.mp4",
    credit: "Creative Commons / Public Domain stock footage",
    durationSec: 20,
    idealReport:
      "At approximately [time], I reviewed the export sample from the Northeast ground-level parking camera. The footage shows parked vehicles in a standard asphalt lot. The weather appears clear and visibility is good. No unauthorized vehicles or persons were identified entering restricted areas. The overall scene remains secure with no incident to report.",
    keyDetails: [
      "Ground-level parking lot",
      "Asphalt surface",
      "Clear visibility / weather",
      "No unauthorized access observed",
      "Routine secure status",
    ],
    manualSection: "Patrol Procedures & Observation",
  },
  {
    id: "aerial-parking",
    title: "Aerial Lot Monitoring",
    briefing:
      "You are reviewing aerial timelapse footage of a large car park. Summarize the flow of traffic and overall capacity observed in this footage.",
    difficulty: "advanced",
    videoUrl: "/videos/aerial-parking.webm",
    credit: "Creative Commons / Public Domain stock footage",
    durationSec: 14,
    idealReport:
      "At approximately [time], I observed an aerial timelapse of the main parking facility. The lot experiences a high volume of vehicle turnover, with cars entering and exiting parking bays continuously. The capacity appears to be relatively high, but traffic flow remains organized in the designated lanes. No traffic collisions or bottlenecks were observed during the timelapse sequence.",
    keyDetails: [
      "Aerial or high-angle vantage point",
      "Timelapse or accelerated footage",
      "High volume of vehicle turnover",
      "Organized traffic flow",
      "No collisions or bottlenecks",
    ],
    manualSection: "Traffic Control & Lot Security",
  },
  {
    id: "shopping-center",
    title: "Strip Mall Exterior",
    briefing:
      "Security cameras capture the exterior of a shopping center. Watch carefully and write a report describing the vehicle movement and the storefront areas.",
    difficulty: "intermediate",
    videoUrl: "/videos/shopping-center.webm",
    credit: "Creative Commons / Public Domain stock footage",
    durationSec: 39,
    idealReport:
      "At approximately [time], I monitored the exterior security camera facing the strip mall. Vehicles can be seen driving through the lot and parking in front of the retail stores. Pedestrians are occasionally visible moving between their cars and the store entrances. Activity is routine, and all vehicles appear to be obeying the posted speed limits within the lot. No suspicious activity was noted.",
    keyDetails: [
      "Exterior of a strip mall or shopping center",
      "Vehicles driving and parking",
      "Pedestrians moving to/from stores",
      "Routine, safe vehicle speeds",
      "No suspicious activity",
    ],
    manualSection: "Observation & Reporting",
  },
  {
    id: "small-mall",
    title: "Store Interior Walk-Through",
    briefing:
      "Review the following security footage inside a retail location. Document the interior layout and any customer behaviour observed.",
    difficulty: "advanced",
    videoUrl: "/videos/small-mall.mp4",
    credit: "Creative Commons / Public Domain stock footage",
    durationSec: 14,
    idealReport:
      "At approximately [time], I reviewed CCTV footage from the interior of the retail store. The video showcases display aisles and the general checkout area. Customers are present and moving through the aisles in a normal shopping manner. There are no signs of shoplifting, aggressive behaviour, or distress. The aisles remain clear of obstructions and safety hazards. Scene is clear.",
    keyDetails: [
      "Retail store interior",
      "Display aisles visible",
      "Customers shopping normally",
      "No shoplifting or aggressive behaviour",
      "Aisles clear of safety hazards",
    ],
    manualSection: "Loss Prevention & Observation",
  },
];

/** Pick a random video scenario, optionally excluding already-completed IDs */
export function pickRandomVideo(excludeIds: string[] = []): VideoScenario {
  const pool = VIDEO_SCENARIOS.filter((v) => !excludeIds.includes(v.id));
  const list = pool.length > 0 ? pool : VIDEO_SCENARIOS;
  return list[Math.floor(Math.random() * list.length)];
}
