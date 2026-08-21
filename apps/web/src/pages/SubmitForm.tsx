import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSubmissionSchema, type CreateSubmissionInput, type SubmissionType } from '@proofdesk/shared';
import { CheckCircle2Icon, Loader2Icon, MessageSquareQuoteIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RatingPicker } from '@/components/RatingStars';

// Public submission form (§9). Client validation runs the exact same Zod
// schema as the server — they can't drift apart, and the server still
// re-validates independently for direct API calls.
const TYPE_LABELS: Record<SubmissionType, string> = {
  written: 'Written',
  video: 'Video',
  social: 'Social media post',
  review: 'Review (e.g. G2)',
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function SubmitForm() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateSubmissionInput>({
    resolver: zodResolver(createSubmissionSchema),
    defaultValues: { type: 'written' },
  });

  const type = watch('type');
  const text = watch('testimonialText') ?? '';
  const linkRequired = type === 'video' || type === 'social';

  async function onSubmit(data: CreateSubmissionInput) {
    try {
      await api('/api/submissions', { method: 'POST', body: JSON.stringify(data) });
      setSubmitted(true);
    } catch (err) {
      // Surface server-side field errors on the same fields the client shows.
      if (err instanceof ApiError && err.issues) {
        for (const [field, messages] of Object.entries(err.issues)) {
          setError(field as keyof CreateSubmissionInput, { message: messages[0] });
        }
      }
      if (err instanceof ApiError && err.status === 429) {
        setError('root', { message: err.message });
      }
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 py-10 px-4">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <MessageSquareQuoteIcon className="size-5 text-primary" />
            Proof Desk
          </Link>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Team sign in
          </Link>
        </div>

        <Card>
          {submitted ? (
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <CheckCircle2Icon className="size-10 text-emerald-600" />
              <div>
                <p className="text-lg font-semibold">Thank you!</p>
                <p className="text-sm text-muted-foreground">
                  Your testimonial was received and is pending review.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                  setSubmitted(false);
                }}
              >
                Submit another
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Share your experience</CardTitle>
                <CardDescription>Tell us how it&apos;s going — it takes a minute.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" autoComplete="name" {...register('name')} />
                    <FieldError message={errors.name?.message} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" autoComplete="email" {...register('email')} />
                    <FieldError message={errors.email?.message} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="company">Company *</Label>
                    <Input id="company" autoComplete="organization" {...register('company')} />
                    <FieldError message={errors.company?.message} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="jobTitle">Job title</Label>
                    <Input id="jobTitle" {...register('jobTitle')} />
                    <FieldError message={errors.jobTitle?.message} />
                  </div>

                  <div className="grid gap-2">
                    <Label>Rating *</Label>
                    <Controller
                      control={control}
                      name="rating"
                      render={({ field }) => (
                        <RatingPicker value={field.value} onChange={field.onChange} />
                      )}
                    />
                    <FieldError message={errors.rating?.message} />
                  </div>

                  <div className="grid gap-2">
                    <Label>Type *</Label>
                    <Controller
                      control={control}
                      name="type"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger aria-label="Testimonial type">
                            <SelectValue placeholder="Choose a type" />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(TYPE_LABELS) as SubmissionType[]).map((t) => (
                              <SelectItem key={t} value={t}>
                                {TYPE_LABELS[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError message={errors.type?.message} />
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="testimonialText">Testimonial *</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {text.length.toLocaleString()} / 5,000
                      </span>
                    </div>
                    <Textarea id="testimonialText" rows={5} {...register('testimonialText')} />
                    <FieldError message={errors.testimonialText?.message} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="sourceLink">Link {linkRequired ? '*' : '(optional)'}</Label>
                    <Input id="sourceLink" type="url" placeholder="https://…" {...register('sourceLink')} />
                    {linkRequired && (
                      <p className="text-xs text-muted-foreground">
                        A link to the original post or video is required for this type.
                      </p>
                    )}
                    <FieldError message={errors.sourceLink?.message} />
                  </div>

                  {errors.root && <FieldError message={errors.root.message} />}

                  <Button type="submit" disabled={isSubmitting} className="mt-2">
                    {isSubmitting && <Loader2Icon className="animate-spin" />}
                    Submit testimonial
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
