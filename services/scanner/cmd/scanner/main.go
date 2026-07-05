package main

import (
  "net/http"

  "github.com/gin-gonic/gin"
)

func main() {
  router := gin.Default()
  router.GET("/health", func(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{
      "status":  "ok",
      "service": "scanner",
      "version": "2.1.0",
    })
  })
  router.GET("/scan", func(c *gin.Context) {
    c.JSON(http.StatusAccepted, gin.H{
      "status": "queued",
      "note":   "Scanner job execution is scaffolded only.",
    })
  })
  _ = router.Run(":8080")
}
