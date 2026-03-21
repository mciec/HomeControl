using Microsoft.AspNetCore.Mvc;

namespace HomeControlBackEnd.Features.Home;

[ApiController]
[Route("")]
public class HomeController : ControllerBase
{
    private readonly IWebHostEnvironment _environment;

    public HomeController(IWebHostEnvironment environment)
    {
        _environment = environment;
    }

    [HttpGet("/")]
    public IActionResult Index()
    {
        // In development, redirect to frontend
        if (_environment.IsDevelopment())
        {
            return Redirect("http://localhost:3000");
        }

        // In production, serve index.html from wwwroot
        return PhysicalFile(
            Path.Combine(_environment.WebRootPath, "index.html"),
            "text/html");
    }
}
