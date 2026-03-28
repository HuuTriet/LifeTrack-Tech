import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Divider,
} from '@mui/material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import api from '../../services/api';

interface TrendPoint {
  date: string;
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  spo2?: number;
  temperature?: number;
  status?: string;
}

interface TrendData {
  range: { from: string; to: string };
  trendData: TrendPoint[];
  anomalies: any[];
  summary: {
    totalReadings: number;
    criticalCount: number;
    warningCount: number;
    normalCount: number;
    averageHeartRate: number | null;
  };
}

interface Props {
  elderlyId?: string;
}

const RANGE_OPTIONS = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last year', value: '1y' },
];

const HealthTrendsPage: React.FC<Props> = ({ elderlyId }) => {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrends = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/health/elderly/${elderlyId}/trends`, {
          params: { range },
        });
        setData(res.data);
      } catch {
        setError('Failed to load health trends.');
      } finally {
        setLoading(false);
      }
    };
    fetchTrends();
  }, [elderlyId, range]);

  const chartData = data?.trendData.map((p) => ({
    ...p,
    date: format(new Date(p.date), 'MMM d'),
  })) ?? [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Health Trends</Typography>
          <Typography variant="body2" color="text.secondary">
            Longitudinal health monitoring with anomaly detection (UC-07)
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={range}
            label="Time Range"
            onChange={(e) => setRange(e.target.value as any)}
          >
            {RANGE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && data && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" fontWeight={700} color="primary.main">
                    {data.summary.totalReadings}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Readings
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" fontWeight={700} color="error.main">
                    {data.summary.criticalCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Critical Alerts
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" fontWeight={700} color="warning.main">
                    {data.summary.warningCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Warnings
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" fontWeight={700} color="success.main">
                    {data.summary.averageHeartRate ?? '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Avg Heart Rate (bpm)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Heart Rate Chart */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>
                Heart Rate Over Time
              </Typography>
              {chartData.length === 0 ? (
                <Typography color="text.secondary" align="center" py={4}>
                  No readings in this period.
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E76F51" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#E76F51" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[40, 180]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <ReferenceLine y={100} stroke="#F4A261" strokeDasharray="5 5" label="High" />
                    <ReferenceLine y={60} stroke="#4A8FB8" strokeDasharray="5 5" label="Low" />
                    <Area
                      type="monotone"
                      dataKey="heartRate"
                      stroke="#E76F51"
                      fill="url(#hrGrad)"
                      strokeWidth={2}
                      name="Heart Rate (bpm)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Blood Pressure Chart */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>
                Blood Pressure Over Time
              </Typography>
              {chartData.length === 0 ? (
                <Typography color="text.secondary" align="center" py={4}>
                  No readings in this period.
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[50, 200]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="bloodPressureSystolic"
                      stroke="#2E5C7F"
                      fill="#2E5C7F"
                      fillOpacity={0.15}
                      strokeWidth={2}
                      name="Systolic (mmHg)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="bloodPressureDiastolic"
                      stroke="#52B788"
                      fill="#52B788"
                      fillOpacity={0.15}
                      strokeWidth={2}
                      name="Diastolic (mmHg)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Anomalies */}
          {data.anomalies.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} mb={2} color="warning.main">
                  AI-Detected Anomalies ({data.anomalies.length})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {data.anomalies.map((a, i) => (
                  <Paper
                    key={i}
                    variant="outlined"
                    sx={{ p: 1.5, mb: 1, borderColor: 'warning.light', bgcolor: '#fffde7' }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">
                        <strong>{format(new Date(a.date), 'MMM d, yyyy HH:mm')}</strong> —{' '}
                        {a.field}: <strong>{a.value} bpm</strong>
                      </Typography>
                      <Chip
                        label={`±${a.deviation} from avg (${a.mean})`}
                        color="warning"
                        size="small"
                      />
                    </Box>
                  </Paper>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
};

export default HealthTrendsPage;
