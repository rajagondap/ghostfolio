import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import java.util.List;

public class WebTableTest {
    public static void clickActionForUser(WebDriver driver, String targetUser) {
        List<WebElement> rows = driver.findElements(By.xpath("//table[@id='dataTable']/tbody/tr"));

        for (WebElement row : rows) {
            String name = row.findElement(By.xpath("./td[1]")).getText();

            if (name.equals(targetUser)) {
                WebElement actionButton = row.findElement(By.xpath("./td[last()]/button"));
                actionButton.click();
                break; // Exit loop once found
            }
        }
    }
}