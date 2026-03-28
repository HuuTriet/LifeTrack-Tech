import React from 'react';
import { Button, ButtonProps, CircularProgress } from '@mui/material';

interface ElderlyButtonProps extends Omit<ButtonProps, 'size'> {
  loading?: boolean;
  icon?: React.ReactNode;
}

/**
 * WCAG 2.1 Level AA compliant button for elderly users.
 * - Minimum height 48px (touch target)
 * - Font size 18px
 * - High contrast colors
 */
const ElderlyButton: React.FC<ElderlyButtonProps> = ({
  children,
  loading = false,
  icon,
  disabled,
  sx,
  ...props
}) => {
  return (
    <Button
      variant="contained"
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : icon}
      sx={{
        minHeight: 48,
        fontSize: '1.125rem',       // 18px
        fontWeight: 600,
        borderRadius: '12px',
        paddingX: 3,
        paddingY: 1.5,
        textTransform: 'none',
        letterSpacing: 0.3,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        '&:hover': {
          boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
          transform: 'translateY(-1px)',
        },
        transition: 'all 0.2s ease',
        ...sx,
      }}
      {...props}
    >
      {children}
    </Button>
  );
};

export default ElderlyButton;
