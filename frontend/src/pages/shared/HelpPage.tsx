import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Button,
  Alert,
  Grid,
  Chip,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  ExpandMore,
  Search,
  Help,
  Email,
  Phone,
  Send,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';

const FAQ_ITEMS = [
  {
    category: 'Medication',
    question: 'How do I add a new medication?',
    answer:
      'Go to Caregiver Dashboard → Medications → Add Medication. You can scan a prescription image with OCR, enter details manually, or create a generic reminder.',
  },
  {
    category: 'Medication',
    question: 'What happens when there is a drug interaction?',
    answer:
      'HIGH severity interactions block the prescription and require confirmation. MODERATE severity shows a warning. LOW severity is logged silently. Always consult a physician before proceeding.',
  },
  {
    category: 'Health',
    question: 'How often should I record vital signs?',
    answer:
      'We recommend recording vital signs at least once daily, preferably at the same time each day. Critical readings will automatically trigger alerts to caregivers.',
  },
  {
    category: 'Health',
    question: 'What do the health status colors mean?',
    answer:
      'Green = Normal (within healthy range). Yellow = Warning (slightly abnormal, monitor closely). Red = Critical (requires immediate attention). Contact a healthcare provider if readings are in the red.',
  },
  {
    category: 'Account',
    question: 'How do I reset my password?',
    answer:
      'Click "Forgot Password" on the login screen. Enter your email address and you will receive a 6-digit reset code valid for 15 minutes.',
  },
  {
    category: 'Account',
    question: 'Why is my account locked?',
    answer:
      'After 5 consecutive failed login attempts, your account is temporarily locked for 30 minutes as a security measure. You can also use "Forgot Password" to regain access immediately.',
  },
  {
    category: 'Notifications',
    question: 'How do I receive medication reminders?',
    answer:
      'Reminders are set automatically when you create a prescription with a scheduled time. You will receive in-app notifications. Critical alerts are also sent via email and SMS.',
  },
  {
    category: 'Reports',
    question: 'How do I export a health report?',
    answer:
      'Go to Caregiver Dashboard → Reports. Select the elderly patient, choose a date range, and click Download. Reports are available in JSON or CSV format.',
  },
];

interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const HelpPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [expanded, setExpanded] = useState<string | false>(false);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<ContactForm>();

  const filteredFaqs = FAQ_ITEMS.filter(
    (faq) =>
      !searchQuery ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const categories = [...new Set(FAQ_ITEMS.map((f) => f.category))];

  const onSubmitContact = async (data: ContactForm) => {
    // In production, send to support email via API
    await new Promise((r) => setTimeout(r, 800)); // simulate API
    setSubmitted(true);
    reset();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Help color="primary" />
        <Typography variant="h5" fontWeight={700}>Help & Support</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Find answers to common questions or contact our support team (UC-17)
      </Typography>

      {/* Search */}
      <TextField
        fullWidth
        placeholder="Search frequently asked questions..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 4 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        }}
      />

      {/* FAQ by category */}
      {(searchQuery ? ['All'] : categories).map((cat) => {
        const items = searchQuery
          ? filteredFaqs
          : filteredFaqs.filter((f) => f.category === cat);

        if (items.length === 0) return null;

        return (
          <Box key={cat} mb={3}>
            {!searchQuery && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip label={cat} size="small" color="primary" variant="outlined" />
              </Box>
            )}
            {items.map((faq, i) => (
              <Accordion
                key={i}
                expanded={expanded === `${cat}-${i}`}
                onChange={(_, isOpen) =>
                  setExpanded(isOpen ? `${cat}-${i}` : false)
                }
                sx={{ mb: 1, '&:before': { display: 'none' }, boxShadow: 1 }}
              >
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography fontWeight={500}>{faq.question}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                    {faq.answer}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        );
      })}

      {filteredFaqs.length === 0 && (
        <Typography color="text.secondary" align="center" py={3}>
          No results found for "{searchQuery}"
        </Typography>
      )}

      {/* Contact Support */}
      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={1}>
            Contact Support
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Can't find the answer you're looking for? Send us a message.
          </Typography>

          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Email color="action" fontSize="small" />
                <Typography variant="body2">support@lifetrack.tech</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Phone color="action" fontSize="small" />
                <Typography variant="body2">+84 28 1234 5678 (Mon–Fri 8–17h)</Typography>
              </Box>
            </Grid>
          </Grid>

          {submitted && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Your message has been sent! We will respond within 24 business hours.
            </Alert>
          )}

          {!submitted && (
            <Box component="form" onSubmit={handleSubmit(onSubmitContact)}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Your Name" required {...register('name')} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Email Address" type="email" required {...register('email')} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Subject" required {...register('subject')} />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Message"
                    multiline
                    rows={4}
                    required
                    placeholder="Describe your issue or question in detail..."
                    {...register('message')}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isSubmitting}
                    startIcon={
                      isSubmitting ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <Send />
                      )
                    }
                  >
                    Send Message
                  </Button>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default HelpPage;
