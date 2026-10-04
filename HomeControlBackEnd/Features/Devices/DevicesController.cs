using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HomeControlBackEnd.Features.Devices;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class DevicesController : ControllerBase
{
    private readonly DeviceRegistry _registry;
    private readonly IDeviceCommandPublisher _publisher;
    private readonly ILogger<DevicesController> _logger;

    public DevicesController(DeviceRegistry registry, IDeviceCommandPublisher publisher, ILogger<DevicesController> logger)
    {
        _registry = registry;
        _publisher = publisher;
        _logger = logger;
    }

    [HttpGet]
    public IActionResult GetDevices()
    {
        var devices = _registry.GetAll()
            .Select(d => new DeviceSummaryDto(d.Id, d.Name, d.Type))
            .ToList();

        return Ok(devices);
    }

    [HttpGet("{id}")]
    public IActionResult GetDevice(string id)
    {
        var config = _registry.GetConfig(id);
        if (config is null)
        {
            return NotFound(new { message = $"Device '{id}' not found." });
        }

        object state = config.Type switch
        {
            DeviceType.LedStripeWithSensors => ToStateDto(_registry.GetLedStripeStateSnapshot(id) ?? new LedStripeWithSensorsState()),
            _ => new { }
        };

        return Ok(new DeviceDetailDto(config.Id, config.Name, config.Type, state));
    }

    [HttpPost("{id}/override")]
    public async Task<IActionResult> PostOverride(string id, [FromBody] OverrideRequestDto? request, CancellationToken ct)
    {
        var config = _registry.GetConfig(id);
        if (config is null)
        {
            return NotFound(new { message = $"Device '{id}' not found." });
        }

        if (config.Type != DeviceType.LedStripeWithSensors)
        {
            return BadRequest(new { message = $"Device '{id}' does not support override commands." });
        }

        if (!Enum.TryParse<OverrideDirection>(request?.Direction, ignoreCase: true, out var direction))
        {
            return BadRequest(new { message = "Direction must be 'Left' or 'Right'." });
        }

        var published = await _publisher.TryPublishOverrideAsync(id, direction, ct);
        if (!published)
        {
            _logger.LogWarning("Could not publish override command for device '{DeviceId}': MQTT broker unavailable.", id);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "MQTT broker is currently unavailable. Try again shortly." });
        }

        return StatusCode(StatusCodes.Status202Accepted);
    }

    private static LedStripeWithSensorsStateDto ToStateDto(LedStripeWithSensorsState state) =>
        LedStripeWithSensorsStateDto.FromState(state);
}
