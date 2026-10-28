import type { PlanResult } from "@/components/planner/event-planner";

export type SavedEventInput = {
  eventType: string;
  title: string;
  eventDate: string;
  guestCount: number;

  location: {
    city: string;
    country: string;
    venueType: string;
  };

  budget: {
    currency: string;
    totalAmount: number;
    contingencyPercent: number;
  };

  preferences: {
    preferredThemes: string[];
    preferredStyles: string[];
    notes: string;
  };

  planningPriorities: string[];
};

export type SavedEventVersion = {
  id: string;
  version: number;
  createdAt: string;
  changeType: "created" | "updated" | "restored" | "recovered";
  restoredFromVersion?: number;
  input: SavedEventInput;
  result: PlanResult;
};

export type SavedEventRecord = {
  id: string;
  schemaVersion: 2;
  createdAt: string;
  updatedAt: string;
  input: SavedEventInput;
  result: PlanResult;
  currentVersionId: string;
  versions: SavedEventVersion[];
};

export type SaveEventRecordInput = {
  id?: string;
  input: SavedEventInput;
  result: PlanResult;
};