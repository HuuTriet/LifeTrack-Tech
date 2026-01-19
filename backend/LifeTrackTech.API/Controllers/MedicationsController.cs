using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LifeTrackTech.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MedicationsController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll()
    {
        // Mock data for now
        var medications = new[]
        {
            new { Id = 1, Name = "Metformin", Dosage = "500mg", Frequency = "2 times daily" },
            new { Id = 2, Name = "Aspirin", Dosage = "100mg", Frequency = "Once daily" }
        };
        
        return Ok(medications);
    }

    [HttpPost]
    public IActionResult Create()
    {
        return StatusCode(501, "Not implemented yet");
    }
}
