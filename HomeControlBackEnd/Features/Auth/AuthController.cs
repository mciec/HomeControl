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

    // returnUrl comes from an unauthenticated query string, so it must be
    // restricted to known-safe destinations - otherwise a crafted login link
    // could ride a legitimate Google sign-in to an open redirect. Only a
    // same-site relative URL or the mobile app's own custom scheme qualify.
    private const string MobileAuthCallbackScheme = "homecontrol://";

    private bool IsAllowedReturnUrl(string? returnUrl) =>
        !string.IsNullOrEmpty(returnUrl) &&
        (Url.IsLocalUrl(returnUrl) || returnUrl.StartsWith(MobileAuthCallbackScheme, StringComparison.OrdinalIgnoreCase));

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

        // A caller (e.g. the React Native app, via a custom URL scheme like
        // homecontrol://auth-callback) can ask to be redirected back to itself
        // instead of the web frontend. Fall back to today's behavior when no
        // (valid) returnUrl is given, so the web app's login flow is unaffected.
        if (IsAllowedReturnUrl(returnUrl))
        {
            return Redirect(returnUrl!);
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
