internal interface IAnimation : IDisposable
{
    void NextFrame();
    void Stop();
    void Start();
}
