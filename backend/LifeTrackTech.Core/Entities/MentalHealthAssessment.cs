namespace LifeTrackTech.Core.Entities;

public class MentalHealthAssessment
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int StressLevel { get; set; }
    public int LonelinessScore { get; set; }
    public int SleepQuality { get; set; }
    public int OverallWellbeingScore { get; set; }
    public string? Notes { get; set; }
    public DateTime AssessedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public User User { get; set; } = null!;
}
