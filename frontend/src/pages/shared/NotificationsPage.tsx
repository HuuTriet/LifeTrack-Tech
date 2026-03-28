import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  Divider,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Badge,
} from '@mui/material';
import {
  Notifications,
  CheckCircle,
  NotificationsOff,
  FiberManualRecord,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import api from '../../services/api';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isRead: boolean;
  createdAt: string;
}

const PRIORITY_COLOR: Record<string, any> = {
  CRITICAL: 'error',
  HIGH: 'warning',
  MEDIUM: 'primary',
  LOW: 'default',
};

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications ?? res.data ?? []);
      setUnread(res.data.unread ?? 0);
    } catch (err: any) {
      setError('Không thể tải thông báo. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {}
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnread((u) => Math.max(0, u - 1));
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Badge badgeContent={unread} color="error">
            <Notifications color="primary" />
          </Badge>
          <Typography variant="h5" fontWeight={700}>
            Notifications
          </Typography>
          {unread > 0 && (
            <Chip label={`${unread} unread`} color="error" size="small" />
          )}
        </Box>
        {unread > 0 && (
          <Button
            startIcon={<CheckCircle />}
            variant="outlined"
            size="small"
            onClick={handleMarkAllRead}
          >
            Mark All Read
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <NotificationsOff sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No notifications yet</Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <List disablePadding>
            {notifications.map((n, idx) => (
              <React.Fragment key={n.id}>
                {idx > 0 && <Divider />}
                <ListItem
                  sx={{
                    py: 2,
                    px: 3,
                    bgcolor: n.isRead ? undefined : '#f0f4ff',
                    alignItems: 'flex-start',
                    cursor: n.isRead ? 'default' : 'pointer',
                  }}
                  onClick={() => !n.isRead && handleMarkRead(n.id)}
                >
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      {!n.isRead && (
                        <FiberManualRecord sx={{ fontSize: 10, color: 'primary.main' }} />
                      )}
                      <Typography
                        variant="subtitle2"
                        fontWeight={n.isRead ? 400 : 700}
                      >
                        {n.title}
                      </Typography>
                      <Chip
                        label={n.priority}
                        color={PRIORITY_COLOR[n.priority]}
                        size="small"
                        sx={{ ml: 'auto' }}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={0.5}>
                      {n.body}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </Typography>
                  </Box>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Card>
      )}
    </Box>
  );
};

export default NotificationsPage;
