using System;
using System.Diagnostics;
using System.IO;

internal static class MeridianFeedbackHostLauncher
{
    private static int Main()
    {
        var directory = AppDomain.CurrentDomain.BaseDirectory;
        var config = File.ReadAllLines(Path.Combine(directory, "host.config"));
        if (config.Length != 2)
        {
            return 2;
        }

        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = config[0],
                Arguments = "\"" + config[1].Replace("\"", "\\\"") + "\"",
                UseShellExecute = false,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            }
        };

        process.Start();
        Console.OpenStandardInput().CopyTo(process.StandardInput.BaseStream);
        process.StandardInput.Close();
        process.StandardOutput.BaseStream.CopyTo(Console.OpenStandardOutput());
        process.WaitForExit();
        return process.ExitCode;
    }
}
