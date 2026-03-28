import React from 'react';
import { Card, CardContent, CardProps, Typography, Box } from '@mui/material';

interface HighContrastCardProps extends CardProps {
  title?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  children: React.ReactNode;
}

/**
 * WCAG 2.1 Level AA compliant card for elderly users.
 * - High contrast borders
 * - Large title font (24px)
 * - Clear visual hierarchy
 */
const HighContrastCard: React.FC<HighContrastCardProps> = ({
  title,
  icon,
  accentColor = '#2E5C7F',
  children,
  sx,
  ...props
}) => {
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: '20px',
        border: `2px solid ${accentColor}22`,
        borderLeft: `6px solid ${accentColor}`,
        backgroundColor: '#FFFFFF',
        boxShadow: '0 2px 12px rgba(46, 92, 127, 0.08)',
        transition: 'box-shadow 0.2s ease',
        '&:hover': {
          boxShadow: '0 6px 24px rgba(46, 92, 127, 0.16)',
        },
        ...sx,
      }}
      {...props}
    >
      <CardContent sx={{ p: 3 }}>
        {(title || icon) && (
          <Box display="flex" alignItems="center" gap={1.5} mb={2}>
            {icon && (
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  backgroundColor: `${accentColor}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
            )}
            {title && (
              <Typography
                variant="h5"
                component="h2"
                sx={{
                  fontSize: '1.5rem',      // 24px — WCAG large text
                  fontWeight: 700,
                  color: accentColor,
                  lineHeight: 1.3,
                }}
              >
                {title}
              </Typography>
            )}
          </Box>
        )}
        {children}
      </CardContent>
    </Card>
  );
};

export default HighContrastCard;
