import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MessageSquarePlus, Send, Star } from 'lucide-react';
import { trackFeedbackSubmitted } from '@/lib/analytics';

interface FeedbackModalProps {
  trigger?: React.ReactNode;
  defaultType?: string;
}

export function FeedbackModal({ trigger, defaultType = 'Design Request' }: FeedbackModalProps) {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState(defaultType);
  const [rating, setRating] = useState(5);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please enter your feedback or request details.');
      return;
    }

    setSubmitting(true);

    try {
      trackFeedbackSubmitted(feedbackType, rating);

      // Construct a clean WhatsApp message so the admin gets instant notification
      const waText = encodeURIComponent(
        `*New Feedback / Request on Sparkling Silver*\n\n` +
        `📌 *Type:* ${feedbackType}\n` +
        `⭐ *Rating:* ${rating}/5\n` +
        `👤 *Dealer/Name:* ${name.trim() || 'Anonymous'}\n` +
        `💬 *Details:*\n${message.trim()}`
      );

      // Open WhatsApp to deliver the request directly to the support team
      const waUrl = `https://wa.me/919330615237?text=${waText}`;
      window.open(waUrl, '_blank');

      toast.success('Thank you! Your feedback has been forwarded to our team.');
      setMessage('');
      setName('');
      setOpen(false);
    } catch (err) {
      toast.error('Could not submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2 border-teal text-teal hover:bg-teal hover:text-white">
            <MessageSquarePlus className="h-4 w-4" />
            <span>Give Feedback / Request Design</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-900">
            Feedback & Design Requests
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Tell us about jewellery designs you'd like to see added or share your feedback on the app.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-slate-700">Category</Label>
            <div className="grid grid-cols-2 gap-2">
              {['Design Request', 'Custom Weight', 'App Feedback', 'Other Inquiry'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFeedbackType(t)}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition-all ${
                    feedbackType === t
                      ? 'border-teal bg-teal/10 text-teal font-semibold'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-slate-700">Experience Rating</Label>
            <div className="flex items-center gap-1.5 pt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 text-amber-400 transition-transform active:scale-90"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dealer-name" className="text-xs font-semibold uppercase text-slate-700">
              Your Name / Business Name (Optional)
            </Label>
            <Input
              id="dealer-name"
              placeholder="e.g. S.K. Jewellers, Mumbai"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-msg" className="text-xs font-semibold uppercase text-slate-700">
              Details / Requirement *
            </Label>
            <Textarea
              id="feedback-msg"
              required
              rows={3}
              placeholder="e.g. Looking for heavy bridal necklace sets or antique kada in 40g-60g range..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-slate-600"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="gap-1.5 bg-[#2C7A76] hover:bg-[#236360] text-white"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{submitting ? 'Submitting...' : 'Send Request'}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
