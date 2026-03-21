using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HomeControlBackEnd.Features.Sample;

[ApiController]
[Route("api/[controller]")]
public class SampleController : ControllerBase
{
    [HttpGet("public")]
    public IActionResult GetPublicData()
    {
        return Ok(new
        {
            message = "This is public data - no authentication required",
            timestamp = DateTime.UtcNow,
            data = new
            {
                title = "Welcome to HomeControl API",
                description = "This endpoint is accessible without authentication"
            }
        });
    }

    [HttpGet("protected")]
    [Authorize]
    public IActionResult GetProtectedData()
    {
        var email = User.FindFirstValue(ClaimTypes.Email);
        var name = User.FindFirstValue(ClaimTypes.Name);

        return Ok(new
        {
            message = "This is protected data - authentication required",
            timestamp = DateTime.UtcNow,
            user = new
            {
                email,
                name
            },
            data = new
            {
                title = "Authenticated User Data",
                description = $"Hello {name}, this endpoint is only accessible to authenticated users"
            }
        });
    }
}
