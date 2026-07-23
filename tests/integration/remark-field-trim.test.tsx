import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RemarkField } from "../../src/routes/_authenticated/cart";

describe("RemarkField (trim persistence)", () => {
  it("saves the trimmed value on blur and rehydrates to the trimmed DB value after refetch", async () => {
    const user = userEvent.setup();

    // Simulated server store — trims on write, like the real mutation + CHECK constraint.
    let dbRemark = "";
    const onSave = vi.fn((remark: string) => {
      dbRemark = remark.trim();
    });

    const { rerender } = render(<RemarkField initial={dbRemark} onSave={onSave} />);
    const textarea = screen.getByPlaceholderText(/add a note/i) as HTMLTextAreaElement;

    // User types with leading/trailing whitespace.
    await user.click(textarea);
    await user.type(textarea, "  size 16 please  ");
    expect(textarea.value).toBe("  size 16 please  ");

    // Blur commits — onSave should receive the trimmed string, matching what the
    // server + DB CHECK constraint will persist.
    await user.tab();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("size 16 please");
    expect(dbRemark).toBe("size 16 please");

    // Simulate the post-mutation refetch landing with the DB (trimmed) value.
    // The UI must rehydrate to exactly what's stored — no whitespace drift.
    rerender(<RemarkField initial={dbRemark} onSave={onSave} />);
    expect(textarea.value).toBe("size 16 please");
    expect(textarea.value).toBe(dbRemark);

    // Focusing and blurring again without changes should NOT fire another save
    // (the trimmed UI value now equals initial).
    await user.click(textarea);
    await user.tab();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("treats a whitespace-only entry as empty when persisting", async () => {
    const user = userEvent.setup();
    let dbRemark = "";
    const onSave = vi.fn((remark: string) => {
      dbRemark = remark.trim();
    });

    render(<RemarkField initial={dbRemark} onSave={onSave} />);
    const textarea = screen.getByPlaceholderText(/add a note/i) as HTMLTextAreaElement;

    await user.click(textarea);
    await user.type(textarea, "     ");
    await user.tab();

    // Initial was empty, trimmed value is also empty → no save fires.
    expect(onSave).not.toHaveBeenCalled();
    expect(dbRemark).toBe("");
  });
});
