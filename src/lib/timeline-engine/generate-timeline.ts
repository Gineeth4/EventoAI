/**
 * EventoAI — Timeline Generation Engine
 *
 * Generates a practical starting schedule for weddings, birthdays,
 * and community events.
 *
 * Dates and dependencies are calculated deterministically.
 * This engine does not require a Gemini API call.
 */

import type {
  DateOnly,
  EventType,
} from "@/types/event";

import type {
  EventTask,
  TaskCategory,
  TaskPriority,
} from "@/types/event-plan";

import { dateOnlySchema } from "@/lib/validation/event-input";
import { validateTimeline } from "@/lib/timeline-engine/validate-timeline";

/** One task template before IDs and dates are assigned. */
type TaskTemplate = {
  key: string;
  title: string;
  description: string;
  daysBeforeEvent: number;
  category: TaskCategory;
  priority: TaskPriority;
  dependsOn: string[];
  estimatedDurationHours?: number;
  isMilestone?: boolean;
};

/** Minimum information required to create a schedule. */
export type TimelineGenerationInput = {
  eventType: EventType;
  eventDate: DateOnly;
};

/**
 * Optional ID factory.
 *
 * Production uses UUIDs so tasks from different events can have
 * globally unique identifiers. Injecting a factory also makes
 * automated tests reproducible.
 */
export type TimelineGenerationOptions = {
  idFactory?: () => string;
};

/**
 * Return an event's common planning tasks.
 *
 * Tasks further from the event date have larger daysBeforeEvent values.
 * Dependencies are expressed through template keys until final IDs
 * have been generated.
 */
function getCommonTemplates(): TaskTemplate[] {
  return [
    {
      key: "define-requirements",
      title: "Define event requirements",
      description:
        "Confirm the purpose, preferences, guest expectations, and essential event requirements.",
      daysBeforeEvent: 60,
      category: "logistics",
      priority: "high",
      dependsOn: [],
      estimatedDurationHours: 2,
    },
    {
      key: "set-initial-budget",
      title: "Establish the initial budget",
      description:
        "Set the spending limit, prioritize major expenses, and decide whether to reserve contingency funds.",
      daysBeforeEvent: 60,
      category: "logistics",
      priority: "high",
      dependsOn: ["define-requirements"],
      estimatedDurationHours: 2,
    },
    {
      key: "shortlist-venue",
      title: "Research and shortlist venues",
      description:
        "Compare suitable venues against the event requirements, guest count, accessibility needs, and budget.",
      daysBeforeEvent: 45,
      category: "venue",
      priority: "high",
      dependsOn: [
        "define-requirements",
        "set-initial-budget",
      ],
      estimatedDurationHours: 4,
    },
    {
      key: "build-guest-list",
      title: "Create the initial guest list",
      description:
        "Prepare an initial list of invitees and record important guest requirements.",
      daysBeforeEvent: 35,
      category: "guest_management",
      priority: "medium",
      dependsOn: ["define-requirements"],
      estimatedDurationHours: 3,
    },
    {
      key: "book-venue",
      title: "Confirm the venue booking",
      description:
        "Review the venue arrangements, costs, terms, and suitability before confirming the booking.",
      daysBeforeEvent: 30,
      category: "venue",
      priority: "critical",
      dependsOn: ["shortlist-venue"],
      estimatedDurationHours: 2,
    },
    {
      key: "compare-vendors",
      title: "Compare suitable vendors",
      description:
        "Identify services needed for the event and compare available options, quotations, and requirements.",
      daysBeforeEvent: 28,
      category: "vendors",
      priority: "high",
      dependsOn: ["set-initial-budget"],
      estimatedDurationHours: 3,
    },
    {
      key: "finalize-guest-list",
      title: "Finalize the invitation list",
      description:
        "Review the guest list and prepare the details needed for invitations or registrations.",
      daysBeforeEvent: 21,
      category: "guest_management",
      priority: "high",
      dependsOn: ["build-guest-list"],
      estimatedDurationHours: 2,
    },
    {
      key: "send-invitations",
      title: "Send invitations or announcements",
      description:
        "Share event details, attendance instructions, and response deadlines with the intended audience.",
      daysBeforeEvent: 20,
      category: "invitations",
      priority: "high",
      dependsOn: [
        "finalize-guest-list",
        "book-venue",
      ],
      estimatedDurationHours: 2,
    },
    {
      key: "prepare-event-schedule",
      title: "Prepare the event-day schedule",
      description:
        "Draft the sequence of activities and coordinate the timing of important arrangements.",
      daysBeforeEvent: 14,
      category: "logistics",
      priority: "high",
      dependsOn: [
        "book-venue",
        "compare-vendors",
      ],
      estimatedDurationHours: 3,
    },
    {
      key: "track-responses",
      title: "Review RSVPs and attendance",
      description:
        "Track replies, registrations, or attendance confirmations and follow up when necessary.",
      daysBeforeEvent: 7,
      category: "guest_management",
      priority: "medium",
      dependsOn: ["send-invitations"],
      estimatedDurationHours: 2,
    },
    {
      key: "confirm-vendor-bookings",
      title: "Confirm vendor arrangements",
      description:
        "Review important service arrangements, timings, responsibilities, and any remaining confirmations.",
      daysBeforeEvent: 5,
      category: "vendors",
      priority: "critical",
      dependsOn: [
        "compare-vendors",
        "prepare-event-schedule",
      ],
      estimatedDurationHours: 2,
    },
    {
      key: "final-event-specific-review",
      title: "Review event-specific arrangements",
      description:
        "Check the additional arrangements required for this particular event type.",
      daysBeforeEvent: 2,
      category: "logistics",
      priority: "high",
      dependsOn: [],
      estimatedDurationHours: 2,
    },
    {
      key: "final-checklist",
      title: "Complete the final event checklist",
      description:
        "Review remaining tasks, important contacts, arrangements, and responsibilities before the event.",
      daysBeforeEvent: 1,
      category: "logistics",
      priority: "critical",
      dependsOn: [
        "confirm-vendor-bookings",
        "track-responses",
        "prepare-event-schedule",
        "final-event-specific-review",
      ],
      estimatedDurationHours: 2,
    },
    {
      key: "event-day-coordination",
      title: "Coordinate event-day activities",
      description:
        "Use the agreed schedule to coordinate activities, resolve issues, and check that essential arrangements are in place.",
      daysBeforeEvent: 0,
      category: "logistics",
      priority: "critical",
      dependsOn: ["final-checklist"],
      estimatedDurationHours: 4,
      isMilestone: true,
    },
  ];
}

/** Additional tasks for wedding planning. */
function getWeddingTemplates(): TaskTemplate[] {
  return [
    {
      key: "book-catering",
      title: "Confirm catering arrangements",
      description:
        "Compare menu options, dietary requirements, serving arrangements, and quotations before confirming the service.",
      daysBeforeEvent: 21,
      category: "catering",
      priority: "critical",
      dependsOn: [
        "book-venue",
        "compare-vendors",
      ],
      estimatedDurationHours: 3,
    },
    {
      key: "book-photography",
      title: "Arrange photography and videography",
      description:
        "Compare suitable packages and confirm the required coverage, timings, and deliverables.",
      daysBeforeEvent: 21,
      category: "vendors",
      priority: "high",
      dependsOn: [
        "book-venue",
        "compare-vendors",
      ],
      estimatedDurationHours: 2,
    },
    {
      key: "design-ceremony-flow",
      title: "Plan the ceremony and reception flow",
      description:
        "Organize ceremony timings, reception activities, key moments, and transitions between activities.",
      daysBeforeEvent: 14,
      category: "logistics",
      priority: "high",
      dependsOn: ["book-venue"],
      estimatedDurationHours: 3,
    },
    {
      key: "confirm-final-headcount",
      title: "Confirm the final guest count",
      description:
        "Review attendance responses and communicate the latest guest count to relevant service providers.",
      daysBeforeEvent: 6,
      category: "guest_management",
      priority: "critical",
      dependsOn: [
        "track-responses",
        "book-catering",
      ],
      estimatedDurationHours: 2,
    },
    {
      key: "finalize-seating-plan",
      title: "Finalize the seating plan",
      description:
        "Prepare seating arrangements based on the confirmed guest count and any accessibility or family requirements.",
      daysBeforeEvent: 3,
      category: "guest_management",
      priority: "high",
      dependsOn: ["confirm-final-headcount"],
      estimatedDurationHours: 3,
    },
  ];
}

/** Additional tasks for birthday celebrations. */
function getBirthdayTemplates(): TaskTemplate[] {
  return [
    {
      key: "select-party-theme",
      title: "Choose the birthday theme",
      description:
        "Select a suitable theme, colour palette, and activity style based on the celebrant's preferences and budget.",
      daysBeforeEvent: 30,
      category: "decor",
      priority: "medium",
      dependsOn: [
        "define-requirements",
        "set-initial-budget",
      ],
      estimatedDurationHours: 2,
    },
    {
      key: "plan-food-and-activities",
      title: "Arrange food and party activities",
      description:
        "Plan the menu, cake, entertainment, games, and other activities suitable for the guests.",
      daysBeforeEvent: 14,
      category: "catering",
      priority: "high",
      dependsOn: [
        "select-party-theme",
        "book-venue",
        "compare-vendors",
      ],
      estimatedDurationHours: 3,
    },
    {
      key: "purchase-decorations",
      title: "Arrange decorations and supplies",
      description:
        "Prepare a checklist of decorations, party supplies, and materials that still need to be purchased or collected.",
      daysBeforeEvent: 7,
      category: "decor",
      priority: "medium",
      dependsOn: [
        "select-party-theme",
        "book-venue",
      ],
      estimatedDurationHours: 2,
    },
    {
      key: "confirm-attendance",
      title: "Confirm birthday party attendance",
      description:
        "Follow up on guest responses and adjust practical arrangements where necessary.",
      daysBeforeEvent: 3,
      category: "guest_management",
      priority: "medium",
      dependsOn: ["track-responses"],
      estimatedDurationHours: 1,
    },
  ];
}

/** Additional tasks for community events. */
function getCommunityTemplates(): TaskTemplate[] {
  return [
    {
      key: "check-permits-and-safety",
      title: "Check permission and safety requirements",
      description:
        "Determine whether the venue or activity requires approvals, safety arrangements, or coordination with local authorities.",
      daysBeforeEvent: 45,
      category: "legal_and_safety",
      priority: "critical",
      dependsOn: [
        "define-requirements",
        "set-initial-budget",
      ],
      estimatedDurationHours: 3,
    },
    {
      key: "recruit-volunteers",
      title: "Recruit and organize volunteers",
      description:
        "Identify required roles, recruit volunteers, and record responsibilities and contact arrangements.",
      daysBeforeEvent: 30,
      category: "logistics",
      priority: "high",
      dependsOn: ["define-requirements"],
      estimatedDurationHours: 3,
    },
    {
      key: "coordinate-equipment",
      title: "Coordinate equipment and event supplies",
      description:
        "Identify equipment, furniture, signage, and other logistical resources that must be supplied or arranged.",
      daysBeforeEvent: 21,
      category: "logistics",
      priority: "high",
      dependsOn: [
        "book-venue",
        "compare-vendors",
      ],
      estimatedDurationHours: 3,
    },
    {
      key: "publish-participant-information",
      title: "Publish participant information",
      description:
        "Share confirmed event details, arrival instructions, accessibility information, and registration guidance.",
      daysBeforeEvent: 14,
      category: "invitations",
      priority: "high",
      dependsOn: [
        "check-permits-and-safety",
        "book-venue",
      ],
      estimatedDurationHours: 2,
    },
    {
      key: "prepare-accessibility-plan",
      title: "Review accessibility and contingency arrangements",
      description:
        "Review access requirements, emergency contacts, possible disruptions, and practical contingency arrangements.",
      daysBeforeEvent: 14,
      category: "legal_and_safety",
      priority: "high",
      dependsOn: [
        "check-permits-and-safety",
        "book-venue",
      ],
      estimatedDurationHours: 3,
    },
    {
      key: "confirm-volunteer-roles",
      title: "Confirm volunteer roles and shifts",
      description:
        "Confirm assigned responsibilities, shift times, arrival instructions, and the person to contact for help.",
      daysBeforeEvent: 3,
      category: "logistics",
      priority: "high",
      dependsOn: [
        "recruit-volunteers",
        "prepare-event-schedule",
      ],
      estimatedDurationHours: 2,
    },
  ];
}

/** Choose the specific tasks appropriate for the requested event. */
function getSpecificTemplates(
  eventType: EventType,
): TaskTemplate[] {
  switch (eventType) {
    case "wedding":
      return getWeddingTemplates();

    case "birthday":
      return getBirthdayTemplates();

    case "community":
      return getCommunityTemplates();
  }
}

/**
 * Identify service-related tasks that need to be finished before
 * the common vendor-confirmation task can be considered complete.
 */
function getAdditionalVendorDependencies(
  eventType: EventType,
): string[] {
  switch (eventType) {
    case "wedding":
      return [
        "book-catering",
        "book-photography",
      ];

    case "birthday":
      return ["plan-food-and-activities"];

    case "community":
      return ["coordinate-equipment"];
  }
}

/** Tasks that must be reviewed before the final checklist. */
function getSpecificReviewDependencies(
  eventType: EventType,
): string[] {
  switch (eventType) {
    case "wedding":
      return [
        "design-ceremony-flow",
        "confirm-final-headcount",
        "finalize-seating-plan",
        "book-catering",
        "book-photography",
      ];

    case "birthday":
      return [
        "select-party-theme",
        "plan-food-and-activities",
        "purchase-decorations",
        "confirm-attendance",
      ];

    case "community":
      return [
        "check-permits-and-safety",
        "coordinate-equipment",
        "publish-participant-information",
        "prepare-accessibility-plan",
        "confirm-volunteer-roles",
      ];
  }
}

/**
 * Construct all templates and connect the type-specific dependencies.
 */
function getTemplates(eventType: EventType): TaskTemplate[] {
  const templates = [
    ...getCommonTemplates(),
    ...getSpecificTemplates(eventType),
  ];

  const vendorDependencies =
    getAdditionalVendorDependencies(eventType);

  const reviewDependencies =
    getSpecificReviewDependencies(eventType);

  return templates.map((template) => {
    if (template.key === "confirm-vendor-bookings") {
      return {
        ...template,
        dependsOn: [
          ...template.dependsOn,
          ...vendorDependencies,
        ],
      };
    }

    if (template.key === "final-event-specific-review") {
      return {
        ...template,
        dependsOn: reviewDependencies,
      };
    }

    return template;
  });
}

/**
 * Subtract whole calendar days in UTC.
 *
 * Using UTC prevents daylight-saving transitions and local machine
 * time zones from shifting date-only deadlines.
 */
function subtractDays(
  eventDate: DateOnly,
  daysBeforeEvent: number,
): DateOnly {
  const date = new Date(`${eventDate}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() - daysBeforeEvent);

  return date.toISOString().slice(0, 10);
}

/**
 * Generate a preparation timeline for an event.
 *
 * The returned plan is a starting template. Users should be able
 * to edit dates and task statuses later; AI may personalize task
 * descriptions in a separate layer.
 */
export function generateTimeline(
  input: TimelineGenerationInput,
  options: TimelineGenerationOptions = {},
): EventTask[] {
  // Reject malformed calendar dates before calculating deadlines.
  const eventDate = dateOnlySchema.parse(input.eventDate);

  const templates = getTemplates(input.eventType);

  // Check that the internal template keys are unique.
  const templateKeys = new Set<string>();

  for (const template of templates) {
    if (templateKeys.has(template.key)) {
      throw new Error(
        `Duplicate timeline template key: "${template.key}".`,
      );
    }

    templateKeys.add(template.key);
  }

  // UUIDs prevent ID collisions between different events.
  const idFactory =
    options.idFactory ??
    (() => globalThis.crypto.randomUUID());

  const idByKey = new Map<string, string>();

  for (const template of templates) {
    const id = idFactory();

    if (!id.trim()) {
      throw new Error(
        "The timeline ID factory returned an empty ID.",
      );
    }

    if ([...idByKey.values()].includes(id)) {
      throw new Error(
        `The timeline ID factory returned a duplicate ID: "${id}".`,
      );
    }

    idByKey.set(template.key, id);
  }

  // Resolve dependency keys into the generated task IDs.
  const tasks: EventTask[] = templates.map((template) => {
    const dependencies = template.dependsOn.map(
      (dependencyKey) => {
        const dependencyId = idByKey.get(dependencyKey);

        if (!dependencyId) {
          throw new Error(
            `Timeline template "${template.key}" references ` +
              `missing dependency "${dependencyKey}".`,
          );
        }

        return dependencyId;
      },
    );

    return {
      id: idByKey.get(template.key)!,
      title: template.title,
      description: template.description,
      dueDate: subtractDays(
        eventDate,
        template.daysBeforeEvent,
      ),
      category: template.category,
      priority: template.priority,
      status: "todo",
      dependsOn: dependencies,
      estimatedDurationHours:
        template.estimatedDurationHours,
      isMilestone: template.isMilestone ?? false,
    };
  });

  // Validate the completed schedule before returning it.
  const validation = validateTimeline(tasks, eventDate);

  if (!validation.success) {
    const details = validation.issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("; ");

    throw new Error(
      `Generated timeline failed validation: ${details}`,
    );
  }

  return validation.data;
}