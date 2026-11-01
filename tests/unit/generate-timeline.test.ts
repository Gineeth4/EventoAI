/**
 * Tests for EventoAI's timeline generation and validation.
 */

import { describe, expect, it } from "vitest";

import {
  generateTimeline,
} from "@/lib/timeline-engine/generate-timeline";

import {
  validateTimeline,
} from "@/lib/timeline-engine/validate-timeline";

/**
 * Generate predictable IDs so test output is reproducible.
 */
function createIdFactory(): () => string {
  let counter = 0;

  return () => `test-task-${++counter}`;
}

describe("generateTimeline", () => {
  it.each([
    {
      eventType: "wedding" as const,
      expectedTask: "Confirm catering arrangements",
    },
    {
      eventType: "birthday" as const,
      expectedTask: "Choose the birthday theme",
    },
    {
      eventType: "community" as const,
      expectedTask: "Check permission and safety requirements",
    },
  ])(
    "generates an appropriate $eventType schedule",
    ({ eventType, expectedTask }) => {
      const eventDate = "2027-12-15";

      const tasks = generateTimeline(
        { eventType, eventDate },
        { idFactory: createIdFactory() },
      );

      expect(tasks.length).toBeGreaterThan(10);

      expect(
        tasks.some((task) => task.title === expectedTask),
      ).toBe(true);

      expect(
        tasks.some((task) => task.dueDate === eventDate),
      ).toBe(true);

      expect(
        tasks.every((task) => task.dueDate <= eventDate),
      ).toBe(true);

      const result = validateTimeline(tasks, eventDate);

      expect(result.success).toBe(true);
    },
  );

  it("rejects duplicate IDs from an injected ID factory", () => {
    expect(() =>
      generateTimeline(
        {
          eventType: "birthday",
          eventDate: "2027-12-15",
        },
        { idFactory: () => "same-id" },
      ),
    ).toThrow(/duplicate ID/i);
  });
});

describe("validateTimeline", () => {
  it("rejects a task scheduled after the event", () => {
    const tasks = [
      {
        id: "task-after",
        title: "Confirm venue",
        dueDate: "2027-12-16",
        category: "venue",
        priority: "high",
        status: "todo",
        dependsOn: [],
      },
    ];

    const result = validateTimeline(
      tasks,
      "2027-12-15",
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.issues.some(
          (issue) => issue.code === "deadline_after_event",
        ),
      ).toBe(true);
    }
  });

  it("rejects a dependency scheduled later than its dependent task", () => {
    const tasks = [
      {
        id: "send-invitations",
        title: "Send invitations",
        dueDate: "2027-12-10",
        category: "invitations",
        priority: "high",
        status: "todo",
        dependsOn: ["finalize-guest-list"],
      },
      {
        id: "finalize-guest-list",
        title: "Finalize guest list",
        dueDate: "2027-12-11",
        category: "guest_management",
        priority: "high",
        status: "todo",
        dependsOn: [],
      },
    ];

    const result = validateTimeline(
      tasks,
      "2027-12-15",
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.issues.some(
          (issue) => issue.code === "dependency_due_date",
        ),
      ).toBe(true);
    }
  });

  it("rejects circular task dependencies", () => {
    const tasks = [
      {
        id: "task-a",
        title: "Task A",
        dueDate: "2027-12-10",
        category: "logistics",
        priority: "medium",
        status: "todo",
        dependsOn: ["task-b"],
      },
      {
        id: "task-b",
        title: "Task B",
        dueDate: "2027-12-11",
        category: "logistics",
        priority: "medium",
        status: "todo",
        dependsOn: ["task-a"],
      },
    ];

    const result = validateTimeline(
      tasks,
      "2027-12-15",
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.issues.some(
          (issue) =>
            issue.message.toLowerCase().includes("circular"),
        ),
      ).toBe(true);
    }
  });
});
describe("generateTimeline edge cases", () => {
  it("produces identical schedules with identical deterministic ID factories", () => {
    const input = {
      eventType: "wedding",
      eventDate: "2027-12-15",
    } as const;

    const first = generateTimeline(input, {
      idFactory: createIdFactory(),
    });

    const second = generateTimeline(input, {
      idFactory: createIdFactory(),
    });

    expect(second).toEqual(first);
  });

  it("calculates deadlines correctly across leap day", () => {
    const eventDate = "2028-04-29";

    const tasks = generateTimeline(
      {
        eventType: "birthday",
        eventDate,
      },
      { idFactory: createIdFactory() },
    );

    const requirementsTask = tasks.find(
      (task) => task.title === "Define event requirements",
    );

    expect(requirementsTask?.dueDate).toBe("2028-02-29");
    expect(validateTimeline(tasks, eventDate).success).toBe(true);
  });

  it("rejects blank IDs from an injected ID factory", () => {
    expect(() =>
      generateTimeline(
        {
          eventType: "birthday",
          eventDate: "2027-12-15",
        },
        { idFactory: () => "   " },
      ),
    ).toThrow(/empty ID/i);
  });

  it("rejects impossible event calendar dates", () => {
    expect(() =>
      generateTimeline({
        eventType: "birthday",
        eventDate: "2027-02-29",
      }),
    ).toThrow();
  });
});

describe("validateTimeline edge cases", () => {
  it("returns a structured issue for an invalid event date", () => {
    const result = validateTimeline([], "2027-02-29");

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.issues[0].code).toBe("invalid_event_date");
      expect(result.issues[0].path).toBe("eventDate");
    }
  });

  it("allows a prerequisite and dependent task to share the same due date", () => {
    const tasks = [
      {
        id: "prepare-event",
        title: "Prepare event",
        dueDate: "2027-12-10",
        category: "logistics",
        priority: "medium",
        status: "todo",
        dependsOn: ["confirm-details"],
      },
      {
        id: "confirm-details",
        title: "Confirm details",
        dueDate: "2027-12-10",
        category: "logistics",
        priority: "medium",
        status: "todo",
        dependsOn: [],
      },
    ];

    const result = validateTimeline(tasks, "2027-12-15");

    expect(result.success).toBe(true);
  });
});
