using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HomeControlBackEnd.Features.Auth;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private static readonly HashSet<string> AllowedEmails = new()
    {
        "michal.cieciora@gmail.com",
        "marczibaa@gmail.com"
    };

    [HttpGet("login")]
    public IActionResult Login(string? returnUrl = null)
    {
        var redirectUrl = Url.Action(nameof(GoogleCallback), "Auth", new { returnUrl });
        var properties = new AuthenticationProperties { RedirectUri = redirectUrl };
        properties.SetParameter("prompt", "select_account");
        return Challenge(properties, GoogleDefaults.AuthenticationScheme);
    }

    [HttpGet("google-callback")]
    public async Task<IActionResult> GoogleCallback(string? returnUrl = null)
    {
        var result = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        
        if (!result.Succeeded)
        {
            return Redirect("/");
        }

        var email = result.Principal?.FindFirstValue(ClaimTypes.Email);
        
        if (string.IsNullOrEmpty(email) || !AllowedEmails.Contains(email))
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Redirect("/?error=unauthorized");
        }

        // Redirect to frontend in development, or root in production
        var isDevelopment = HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment();
        var redirectTarget = isDevelopment ? "http://localhost:3000" : "/";
        
        return Redirect(redirectTarget);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        
        // Clear all cookies
        foreach (var cookie in Request.Cookies.Keys)
        {
            Response.Cookies.Delete(cookie);
        }

        return Ok(new { message = "Logged out successfully" });
    }

    [HttpGet("user")]
    [Authorize]
    public IActionResult GetUser()
    {
        var email = User.FindFirstValue(ClaimTypes.Email);
        var name = User.FindFirstValue(ClaimTypes.Name);

        return Ok(new
        {
            email,
            name,
            isAuthenticated = User.Identity?.IsAuthenticated ?? false
        });
    }

    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        return Ok(new
        {
            isAuthenticated = User.Identity?.IsAuthenticated ?? false,
            email = User.FindFirstValue(ClaimTypes.Email)
        });
    }
}
