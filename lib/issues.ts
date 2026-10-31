export type IssueStatus = "Reported" | "AI Reviewed" | "Awaiting confirmation" | "Community verified" | "Escalated";

export type CivicIssue = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: IssueStatus;
  location: string;
  demo: boolean;
  sampleImage?: string;
  position?: [number, number];
};

export const sampleIssues: CivicIssue[] = [
  {
    id: "sample-1",
    title: "Pothole at the school entrance",
    description: "A road surface hazard needs a closer look from nearby residents.",
    category: "Roads",
    status: "Awaiting confirmation",
    location: "Sample location · Bhubaneswar, Odisha",
    demo: true,
    sampleImage: "/images/demo-issues/sample-pothole.jpg",
    position: [20.2998, 85.8246],
  },
  {
    id: "sample-2",
    title: "Water pooling beside the market road",
    description: "Standing water remains after rain near a busy walking route.",
    category: "Drainage",
    status: "Community verified",
    location: "Sample location · Bhubaneswar, Odisha",
    demo: true,
    sampleImage: "/images/demo-issues/sample-drainage.jpg",
    position: [20.2915, 85.8317],
  },
  {
    id: "sample-3",
    title: "Streetlight out on a residential lane",
    description: "A dark stretch could use a lighting check after sunset.",
    category: "Streetlight",
    status: "Escalated",
    location: "Sample location · Bhubaneswar, Odisha",
    demo: true,
    sampleImage: "/images/demo-issues/sample-streetlight.jpg",
    position: [20.3042, 85.8161],
  },
];

export const issueCategories = ["Roads", "Drainage", "Garbage & sanitation", "Water supply", "Streetlight", "Public space", "Other"];
