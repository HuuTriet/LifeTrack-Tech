namespace LifeTrackTech.Core.Entities;

public class HealthMetric
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string MetricType { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public string? Unit { get; set; }
    public DateTime MeasuredAt { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public User User { get; set; } = null!;
}
