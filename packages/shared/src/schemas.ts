import { z } from 'zod';

// ---------------------------------------------------------------------------
// One schema, shared by client and server (implementation plan §5). The public
// form's client-side validation and the API's server-side validation can never
// silently drift apart, because they are literally the same object.
// ---------------------------------------------------------------------------

export const submissionType = z.enum(['written', 'video', 'social', 'review']);
export const submissionStatus = z.enum(['pending', 'approved', 'rejected']);

export type SubmissionType = z.infer<typeof submissionType>;
export type SubmissionStatus = z.infer<typeof submissionStatus>;

export const createSubmissionSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    email: z.string().trim().email('Enter a valid email address').max(255),
    company: z.string().trim().min(1, 'Company is required').max(160),
    jobTitle: z.string().trim().max(160).optional(),
    rating: z.coerce.number().int('Rating must be a whole number').min(1, 'Pick a rating').max(5, 'Rating must be between 1 and 5'),
    testimonialText: z.string().trim().min(1, 'Testimonial text is required').max(5000, 'Keep it under 5,000 characters'),
    type: submissionType,
    sourceLink: z
      .string()
      .trim()
      .url('Enter a valid URL (including https://)')
      .max(2048)
      .refine((u) => /^https?:\/\//i.test(u), 'Only http(s) links are allowed')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.type === 'video' || data.type === 'social') && !data.sourceLink) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceLink'],
        message: 'A link is required for video and social submissions.',
      });
    }
  });

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export const submissionFilterSchema = z.object({
  status: submissionStatus.optional(),
  type: submissionType.optional(),
  ratingMin: z.coerce.number().int().min(1).max(5).optional(),
  ratingMax: z.coerce.number().int().min(1).max(5).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  q: z.string().trim().max(200).optional(),
});

export type SubmissionFilter = z.infer<typeof submissionFilterSchema>;

export const bulkStatusSchema = z
  .object({
    status: submissionStatus,
    mode: z.enum(['ids', 'filter']),
    ids: z.array(z.number().int().positive()).max(2000).optional(),
    filter: submissionFilterSchema.optional(),
    excludeIds: z.array(z.number().int().positive()).max(2000).optional(),
  })
  .refine((d) => (d.mode === 'ids' ? !!d.ids?.length : !!d.filter), {
    message: 'ids required for mode "ids"; filter required for mode "filter"',
  });

export type BulkStatusInput = z.infer<typeof bulkStatusSchema>;

export const updateStatusSchema = z.object({
  status: submissionStatus,
  rejectionNote: z.string().trim().max(500).optional(),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

// List query contract (§7). Sort is allow-listed server-side — a client-supplied
// column name is never interpolated into ORDER BY. Bad values are clamped or
// defaulted (`.catch`), never 400s: an unrecognized sort must not become an
// error, a page below 1 clamps to 1, and pageSize caps at 100 regardless of
// what the client asks for.
export const listQuerySchema = z.object({
  status: submissionStatus.optional().catch(undefined),
  type: submissionType.optional().catch(undefined),
  ratingMin: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
  ratingMax: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
  dateFrom: z.string().optional().catch(undefined),
  dateTo: z.string().optional().catch(undefined),
  q: z.string().trim().max(200).optional().catch(undefined),
  sort: z.enum(['submittedAt', 'rating', 'status', 'company', 'name']).catch('submittedAt'),
  dir: z.enum(['asc', 'desc']).catch('desc'),
  page: z.coerce
    .number()
    .int()
    .catch(1)
    .transform((n) => Math.max(1, n)),
  pageSize: z.coerce
    .number()
    .int()
    .catch(25)
    .transform((n) => Math.min(100, Math.max(1, n))),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export const loginSchema = z.object({
  role: z.enum(['reviewer', 'viewer']),
});

// Response shapes (§5)
export interface Submission {
  id: number;
  name: string;
  email: string;
  company: string;
  jobTitle: string | null;
  rating: 1 | 2 | 3 | 4 | 5;
  testimonialText: string;
  type: SubmissionType;
  sourceLink: string | null;
  status: SubmissionStatus;
  submittedAt: string; // ISO 8601
  reviewedAt: string | null;
  reviewedBy: 'reviewer' | null;
  rejectionNote: string | null;
}

export interface NotificationRow {
  id: number;
  submissionId: number;
  recipientEmail: string;
  previousStatus: SubmissionStatus | null;
  newStatus: SubmissionStatus;
  message: string;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AuthUser {
  role: 'reviewer' | 'viewer';
  displayName: string;
}
