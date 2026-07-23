import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RemarkField } from "@/routes/_authenticated/cart";

describe("RemarkField (cart integration)", () => {
  it("does not clobber in-progress typing when a background refetch updates `initial`", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    const { rerender } = render(<RemarkField initial="" onSave={onSave} />);
    const textarea = screen.getByPlaceholderText(/add a note/i) as HTMLTextAreaElement;

    // User focuses and starts typing a new remark.
    await user.click(textarea);
    await user.type(textarea, "Please make size 16");
    expect(textarea.value).toBe("Please make size 16");

    // Simulate a background cart refetch landing while the user is still typing.
    // The `initial` prop changes (e.g. a stale server value) but the user has focus.
    rerender(<RemarkField initial="stale server value" onSave={onSave} />);

    // The in-progress input MUST NOT be overwritten by the refetch.
    expect(textarea.value).toBe("Please make size 16");

    // Continue typing — still not clobbered.
    await user.type(textarea, "!");
    expect(textarea.value).toBe("Please make size 16!");

    // Blur commits the save with the user's text, not the stale server value.
    await user.tab();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("Please make size 16!");
  });

  it("syncs from server `initial` only when the field is not focused", () => {
    const onSave = vi.fn();
    const { rerender } = render(<RemarkField initial="one" onSave={onSave} />);
    const textarea = screen.getByPlaceholderText(/add a note/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe("one");

    // No focus — a refetch that changes `initial` should update the shown value.
    rerender(<RemarkField initial="two" onSave={onSave} />);
    expect(textarea.value).toBe("two");
  });

  it("does not fire onSave on blur when only whitespace differs from initial", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<RemarkField initial="hello" onSave={onSave} />);
    const textarea = screen.getByPlaceholderText(/add a note/i) as HTMLTextAreaElement;

    await user.click(textarea);
    // Append trailing spaces only; trimmed value equals initial.
    await user.type(textarea, "   ");
    await user.tab();

    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks save when the value exceeds the 500 character limit", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<RemarkField initial="" onSave={onSave} />);
    const textarea = screen.getByPlaceholderText(/add a note/i) as HTMLTextAreaElement;

    // The onChange handler caps at 500 chars, so paste + fireEvent to bypass and
    // simulate an over-limit state (defence-in-depth check).
    await user.click(textarea);
    act(() => {
      // Directly set value + dispatch input to bypass maxLength slicing.
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )!.set!;
      setter.call(textarea, "x".repeat(501));
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await user.tab();

    expect(onSave).not.toHaveBeenCalled();
    expect(textarea).toHaveAttribute("aria-invalid", "true");
  });
});
