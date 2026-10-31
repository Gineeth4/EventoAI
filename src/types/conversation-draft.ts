/**
 * Shared draft state shape for the conversational event planner.
 * Kept separate from UI components to avoid reverse type dependencies.
 */

export type ConversationDraft = {
  idea: string;
  eventType: string;
  title: string;
  eventDate: string;
  guestCount: string;
  city: string;
  country: string;
  venueType: "" | "indoor" | "outdoor";
  currency: string;
  totalAmount: string;
  contingencyPercent: string;
  contingencyChosen: boolean;
  themes: string[];
  styles: string[];
  notes: string;
  planningPriorities: string[];
  assumptions: string[];
};
